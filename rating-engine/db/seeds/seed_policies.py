#!/usr/bin/env python3
"""
seed_policies.py
================
Generates and bulk-inserts ~80,000,000 realistic Japan auto insurance
historical policy records into the japan_auto_policies PostgreSQL table.

Features:
  - Parallel generation using multiprocessing (one worker per core)
  - Bulk insert via psycopg2 COPY for maximum throughput
  - Resumes from where it left off (checks existing row count first)
  - Progress bar with ETA
  - Realistic Japan distributions (population-weighted prefectures,
    actual vehicle fleet splits, NCD grade real-world distribution)

Usage:
  python seed_policies.py                       # full 80M rows
  python seed_policies.py --rows 1000000        # quick test (1M)
  python seed_policies.py --workers 8           # override worker count
  python seed_policies.py --batch 500000        # rows per batch

Prerequisites:
  pip install psycopg2-binary numpy tqdm python-dotenv
"""

import argparse
import io
import multiprocessing as mp
import os
import sys
import time
from datetime import date, timedelta
from pathlib import Path

import numpy as np
import psycopg2
from dotenv import load_dotenv

# ── Load .env ─────────────────────────────────────────────────────────
load_dotenv(Path(__file__).parent.parent / ".env")

DB_HOST     = os.getenv("DB_HOST", "localhost")
DB_PORT     = int(os.getenv("DB_PORT", 5432))
DB_NAME     = os.getenv("DB_NAME", "insurance_poc")
DB_USER     = os.getenv("DB_USER", "postgres")
DB_PASSWORD = os.getenv("DB_PASSWORD", "postgres")

TARGET_ROWS = 80_000_000
DEFAULT_BATCH = 500_000

# ── Japan realistic distributions ─────────────────────────────────────

NCD_GRADES = list(range(1, 21))
NCD_W = np.array([0.02,0.03,0.04,0.04,0.05,0.08,0.07,0.07,0.06,0.06,
                   0.06,0.06,0.06,0.06,0.06,0.06,0.05,0.05,0.04,0.04])
NCD_P = NCD_W / NCD_W.sum()

AGE_CONDS = ["all","21+","26+","30+","35+"]
AGE_P = np.array([0.05,0.10,0.30,0.30,0.25]); AGE_P /= AGE_P.sum()

# Prefecture weights based on registered vehicle proportions (2024 data)
PREF_CODES = [f"{i:02d}" for i in range(1, 48)]
PREF_W = np.array([
    # 01 Hokkaido, 02 Aomori, 03 Iwate, 04 Miyagi, 05 Akita
    3.6, 0.7, 0.6, 1.2, 0.5,
    # 06 Yamagata, 07 Fukushima, 08 Ibaraki, 09 Tochigi, 10 Gunma
    0.5, 0.9, 1.6, 1.1, 1.1,
    # 11 Saitama, 12 Chiba, 13 Tokyo, 14 Kanagawa, 15 Niigata
    4.2, 3.8, 8.2, 5.3, 1.1,
    # 16 Toyama, 17 Ishikawa, 18 Fukui, 19 Yamanashi, 20 Nagano
    0.6, 0.6, 0.4, 0.5, 1.1,
    # 21 Gifu, 22 Shizuoka, 23 Aichi, 24 Mie, 25 Shiga
    1.1, 2.1, 8.9, 0.9, 0.8,
    # 26 Kyoto, 27 Osaka, 28 Hyogo, 29 Nara, 30 Wakayama
    1.4, 5.3, 3.3, 0.7, 0.5,
    # 31 Tottori, 32 Shimane, 33 Okayama, 34 Hiroshima, 35 Yamaguchi
    0.3, 0.3, 1.0, 1.6, 0.7,
    # 36 Tokushima, 37 Kagawa, 38 Ehime, 39 Kochi, 40 Fukuoka
    0.4, 0.5, 0.7, 0.4, 2.9,
    # 41 Saga, 42 Nagasaki, 43 Kumamoto, 44 Oita, 45 Miyazaki
    0.4, 0.7, 0.9, 0.6, 0.6,
    # 46 Kagoshima, 47 Okinawa
    0.8, 0.7,
])
PREF_P = PREF_W / PREF_W.sum()

VEH_CLASSES = [1, 3, 5, 7, 9, 11, 13, 15]
VEH_W = np.array([0.22, 0.12, 0.24, 0.20, 0.10, 0.06, 0.04, 0.02])
VEH_P = VEH_W / VEH_W.sum()

DR_TYPES = ["none", "family", "spouse", "self"]
DR_W = np.array([0.28, 0.18, 0.34, 0.20]); DR_P = DR_W / DR_W.sum()

KM_BANDS = ["〜5,000","5,001〜10,000","10,001〜15,000","15,001〜20,000","20,001〜"]
KM_MID   = [3000, 7500, 12500, 17500, 25000]
KM_W = np.array([0.12, 0.26, 0.34, 0.18, 0.10]); KM_P = KM_W / KM_W.sum()

GENDERS = ["M", "F"]
GENDER_P = np.array([0.68, 0.32])

FUELS = ["gasoline", "diesel", "hybrid", "electric", "phev"]
FUEL_P = np.array([0.60, 0.05, 0.28, 0.04, 0.03])

MAKES = ["Toyota","Honda","Nissan","Suzuki","Daihatsu","Subaru","Mazda","Mitsubishi","Yamaha","Lexus"]
MAKE_P = np.array([0.30,0.18,0.14,0.12,0.10,0.06,0.05,0.03,0.01,0.01])
MAKE_P /= MAKE_P.sum()

# Base premiums (¥) per vehicle class — matches excel_reader.py Base_Premiums sheet
BASE_BI  = {1:28000,3:33000,5:38000,7:45000,9:52000,11:60000,13:68000,15:78000}
BASE_PD  = {1:22000,3:27000,5:31000,7:37000,9:43000,11:50000,13:57000,15:65000}
BASE_VEH = {1:48000,3:58000,5:68000,7:80000,9:94000,11:108000,13:122000,15:140000}
BASE_PAX = {1: 8000,3: 9500,5:11000,7:13000,9:15000,11:17000,13:19000,15:22000}

# NCD multipliers (simplified — grade 6 = 1.0 baseline)
NCD_MULT = {
    1:2.32, 2:2.05, 3:1.85, 4:1.65, 5:1.45,
    6:1.00, 7:0.90, 8:0.82, 9:0.74, 10:0.68,
    11:0.63, 12:0.59, 13:0.55, 14:0.52, 15:0.49,
    16:0.46, 17:0.44, 18:0.42, 19:0.40, 20:0.38,
}

AGE_MULT = {"all":1.27,"21+":1.13,"26+":1.00,"30+":0.92,"35+":0.85}
DR_MULT  = {"none":1.00,"family":0.95,"spouse":0.92,"self":0.88}

# Prefecture BI/PD and vehicle multipliers (simplified representative values)
def _pref_mult(code):
    table = {
        "13":1.18,"14":1.14,"11":1.10,"27":1.12,"23":1.08,
        "01":0.95,"40":1.02,"28":1.05,"12":1.08,"22":1.00,
    }
    return table.get(code, 1.00), table.get(code, 0.98)


def _compute_premium(ncd, age_cond, pref_code, veh_cls, dr, rng):
    """Compute 4-coverage premium chain with ±5% noise."""
    nm = NCD_MULT.get(ncd, 1.0)
    am = AGE_MULT.get(age_cond, 1.0)
    bi_pd_pf, veh_pf = _pref_mult(pref_code)
    drm = DR_MULT.get(dr, 1.0)

    bi  = BASE_BI .get(veh_cls, 45000) * nm * am * bi_pd_pf * drm
    pd  = BASE_PD .get(veh_cls, 37000) * nm * am * bi_pd_pf * drm
    veh = BASE_VEH.get(veh_cls, 80000)       * am * veh_pf    * drm
    pax = BASE_PAX.get(veh_cls, 13000) * nm * am * bi_pd_pf * drm

    noise = rng.normal(1.0, 0.05)
    bi, pd, veh, pax = int(bi*noise), int(pd*noise), int(veh*noise), int(pax*noise)
    total = bi + pd + veh + pax
    return bi, pd, veh, pax, total


def _assign_tier(premium):
    if premium < 80000:   return "Low"
    if premium < 140000:  return "Medium"
    if premium < 220000:  return "High"
    return "Very High"


def generate_batch(args):
    """Generate one batch of rows, return as CSV bytes ready for COPY."""
    batch_id, n, seed = args
    rng = np.random.default_rng(seed)

    ncds   = rng.choice(NCD_GRADES,  n, p=NCD_P)
    ages   = rng.choice(AGE_CONDS,   n, p=AGE_P)
    prefs  = rng.choice(PREF_CODES,  n, p=PREF_P)
    vcls   = rng.choice(VEH_CLASSES, n, p=VEH_P)
    drs    = rng.choice(DR_TYPES,    n, p=DR_P)
    km_bs  = rng.choice(KM_BANDS,    n, p=KM_P)
    km_vs  = np.array([KM_MID[KM_BANDS.index(k)] for k in km_bs])
    d_ages = rng.integers(18, 76, n)
    nacc   = rng.choice([0,1,2,3,4,5], n, p=[0.70,0.15,0.08,0.04,0.02,0.01])
    nviol  = rng.choice([0,1,2,3,4],   n, p=[0.72,0.16,0.07,0.03,0.02])
    ylicen = np.clip(d_ages - 18 - rng.integers(0, 4, n), 0, 57)
    gends  = rng.choice(GENDERS, n, p=GENDER_P)
    makes  = rng.choice(MAKES,   n, p=MAKE_P)
    fuels  = rng.choice(FUELS,   n, p=FUEL_P)
    v_yrs  = rng.integers(2000, 2026, n)
    ekei   = rng.random(n) < 0.22   # 22% of Japan fleet is kei cars
    first  = rng.random(n) < 0.05

    base_pol_id = batch_id * n
    base_year = 2000
    years_span = 25

    buf = io.StringIO()
    for i in range(n):
        pol_id = base_pol_id + i + 1
        pol_num = f"JP{pol_id:015d}"
        py = base_year + (pol_id % years_span)
        start = date(py, rng.integers(1, 13), 1)

        bi, pd_, veh, pax, total = _compute_premium(
            int(ncds[i]), ages[i], prefs[i], int(vcls[i]), drs[i], rng
        )
        tier = _assign_tier(total)
        claim_prob = 0.04 + nacc[i] * 0.03 + nviol[i] * 0.01
        had_claim = rng.random() < claim_prob
        n_claims = int(rng.integers(1, 4)) if had_claim else 0
        claim_amt = int(rng.integers(50000, total * 3)) if had_claim else 0

        row = (
            f"{pol_num}\t{py}\t{start}\t"
            f"{ncds[i]}\t{ages[i]}\t{prefs[i]}\t{vcls[i]}\t{drs[i]}\t"
            f"{km_bs[i]}\t{km_vs[i]}\t"
            f"{d_ages[i]}\t{ylicen[i]}\t{nacc[i]}\t{nviol[i]}\t"
            f"{gends[i]}\t{'t' if first[i] else 'f'}\t"
            f"{makes[i]}\t{v_yrs[i]}\t{fuels[i]}\t{'t' if ekei[i] else 'f'}\t"
            f"{bi}\t{pd_}\t{veh}\t{pax}\t{total}\t"
            f"{tier}\t{'t' if had_claim else 'f'}\t{n_claims}\t{claim_amt}\n"
        )
        buf.write(row)

    return buf.getvalue().encode("utf-8")


COPY_COLUMNS = (
    "policy_number,policy_year,start_date,"
    "ncd_grade,age_condition,prefecture_code,vehicle_rating_class,driver_restriction,"
    "annual_km_band,annual_km,"
    "driver_age,years_licensed,num_accidents_5yr,num_violations_5yr,"
    "driver_gender,is_first_car,"
    "vehicle_make,vehicle_year,fuel_type,is_kei_car,"
    "bi_premium,pd_premium,vehicle_premium,passenger_premium,annual_premium_jpy,"
    "risk_tier,had_claim,num_claims,total_claim_amount_jpy"
)


def get_existing_count():
    conn = psycopg2.connect(
        host=DB_HOST, port=DB_PORT, dbname=DB_NAME,
        user=DB_USER, password=DB_PASSWORD
    )
    with conn.cursor() as cur:
        cur.execute("SELECT COUNT(*) FROM japan_auto_policies")
        count = cur.fetchone()[0]
    conn.close()
    return count


def insert_batch(data: bytes):
    conn = psycopg2.connect(
        host=DB_HOST, port=DB_PORT, dbname=DB_NAME,
        user=DB_USER, password=DB_PASSWORD
    )
    conn.autocommit = False
    try:
        with conn.cursor() as cur:
            cur.copy_from(
                io.BytesIO(data),
                "japan_auto_policies",
                columns=COPY_COLUMNS.split(","),
                sep="\t",
                null="\\N",
            )
        conn.commit()
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        conn.close()


def main():
    parser = argparse.ArgumentParser(description="Seed Japan auto insurance 80M rows")
    parser.add_argument("--rows",    type=int, default=TARGET_ROWS)
    parser.add_argument("--batch",   type=int, default=DEFAULT_BATCH)
    parser.add_argument("--workers", type=int, default=max(1, mp.cpu_count() - 1))
    args = parser.parse_args()

    existing = get_existing_count()
    remaining = args.rows - existing
    if remaining <= 0:
        print(f"✅  Table already has {existing:,} rows — nothing to do.")
        return

    print(f"🇯🇵  Japan Auto Insurance Seeder")
    print(f"    Target    : {args.rows:>15,} rows")
    print(f"    Existing  : {existing:>15,} rows")
    print(f"    To insert : {remaining:>15,} rows")
    print(f"    Batch size: {args.batch:>15,}")
    print(f"    Workers   : {args.workers:>15}")
    print()

    n_batches = (remaining + args.batch - 1) // args.batch
    t0 = time.time()
    inserted = 0

    batch_id_start = existing // args.batch

    with mp.Pool(processes=args.workers) as pool:
        for b_idx, data in enumerate(
            pool.imap_unordered(
                generate_batch,
                [
                    (batch_id_start + b, min(args.batch, remaining - b * args.batch), (batch_id_start + b) * 7919)
                    for b in range(n_batches)
                    if remaining - b * args.batch > 0
                ],
            )
        ):
            insert_batch(data)
            inserted += len(data.decode("utf-8").strip().splitlines())
            elapsed = time.time() - t0
            rate = inserted / elapsed if elapsed > 0 else 0
            eta_s = (remaining - inserted) / rate if rate > 0 else 0
            pct = 100.0 * inserted / remaining
            print(
                f"  [{pct:5.1f}%] {inserted:>12,}/{remaining:>12,} rows  "
                f"| {rate:>8,.0f} rows/s  "
                f"| ETA {eta_s/60:.1f} min",
                end="\r", flush=True,
            )

    print(f"\n\n✅  Inserted {inserted:,} rows in {(time.time()-t0)/60:.1f} min")
    print("    Refreshing materialized view...")

    conn = psycopg2.connect(
        host=DB_HOST, port=DB_PORT, dbname=DB_NAME,
        user=DB_USER, password=DB_PASSWORD
    )
    conn.autocommit = True
    with conn.cursor() as cur:
        cur.execute("REFRESH MATERIALIZED VIEW CONCURRENTLY mv_prefecture_stats")
    conn.close()
    print("✅  Materialized view refreshed. Database ready.")


if __name__ == "__main__":
    main()
