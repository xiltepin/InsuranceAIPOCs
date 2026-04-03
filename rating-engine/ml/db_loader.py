"""
db_loader.py
============
Connects to PostgreSQL and returns a training-ready DataFrame
sampled from japan_auto_policies.

The sample uses PostgreSQL TABLESAMPLE SYSTEM for fast random
sampling without a full table scan (O(blocks) not O(rows)).

Usage:
    from ml.db_loader import load_training_data
    df = load_training_data(n_samples=1_000_000)
"""

import os
import logging
from pathlib import Path

import pandas as pd
import psycopg2
from psycopg2 import sql
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / ".env")

log = logging.getLogger(__name__)

# ── Column mapping: DB column → trainer feature name ──────────────────
QUERY_COLUMNS = [
    "ncd_grade",
    "age_condition",
    "prefecture_code",
    "vehicle_rating_class",
    "driver_restriction",
    "annual_km_band",
    "annual_km",
    "driver_age",
    "num_accidents_5yr   AS num_accidents",
    "num_violations_5yr  AS num_violations",
    "years_licensed",
    "annual_premium_jpy",
    "risk_tier",
]

SELECT_COLS = ", ".join(QUERY_COLUMNS)


def _get_conn():
    return psycopg2.connect(
        host=os.getenv("DB_HOST", "localhost"),
        port=int(os.getenv("DB_PORT", 5432)),
        dbname=os.getenv("DB_NAME", "insurance_poc"),
        user=os.getenv("DB_USER", "postgres"),
        password=os.getenv("DB_PASSWORD", "postgres"),
        connect_timeout=10,
    )


def get_total_row_count() -> int:
    """Fast approximate count using pg_class statistics."""
    conn = _get_conn()
    with conn.cursor() as cur:
        cur.execute(
            """SELECT reltuples::BIGINT
               FROM pg_class
               WHERE relname = 'japan_auto_policies'"""
        )
        row = cur.fetchone()
    conn.close()
    return int(row[0]) if row else 0


def load_training_data(n_samples: int = 1_000_000) -> pd.DataFrame:
    """
    Return a random sample of n_samples rows as a pandas DataFrame.

    Uses PostgreSQL TABLESAMPLE SYSTEM for O(blocks) random sampling,
    then LIMIT n_samples to trim. Much faster than ORDER BY RANDOM().

    For 80M rows, TABLESAMPLE SYSTEM(1.25) returns ~1M rows in ~2-4 s.
    """
    n_samples = max(1000, int(n_samples))
    total = get_total_row_count()

    if total == 0:
        raise RuntimeError(
            "Table japan_auto_policies is empty. "
            "Run db/seeds/seed_policies.py first."
        )

    # Calculate BERNOULLI percentage needed to get at least n_samples rows
    pct = min(100.0, (n_samples / max(total, 1)) * 100 * 1.25)

    query = f"""
        SELECT
            ncd_grade,
            age_condition::TEXT,
            prefecture_code::TEXT,
            vehicle_rating_class,
            driver_restriction::TEXT,
            annual_km_band::TEXT,
            annual_km,
            driver_age,
            num_accidents_5yr   AS num_accidents,
            num_violations_5yr  AS num_violations,
            years_licensed,
            annual_premium_jpy,
            risk_tier::TEXT
        FROM japan_auto_policies
        TABLESAMPLE SYSTEM({pct:.4f})
        LIMIT {n_samples}
    """

    log.info("Loading %s training rows from DB (table has ~%s rows, TABLESAMPLE %.2f%%)",
             f"{n_samples:,}", f"{total:,}", pct)

    conn = _get_conn()
    try:
        df = pd.read_sql_query(query, conn)
    finally:
        conn.close()

    # Ensure dtypes match what trainer expects
    df["vehicle_rating_class"] = df["vehicle_rating_class"].astype(str)
    df["ncd_grade"]            = df["ncd_grade"].astype(int)
    df["annual_km"]            = df["annual_km"].astype(int)
    df["driver_age"]           = df["driver_age"].astype(int)
    df["num_accidents"]        = df["num_accidents"].astype(int)
    df["num_violations"]       = df["num_violations"].astype(int)
    df["years_licensed"]       = df["years_licensed"].astype(int)
    df["annual_premium_jpy"]   = df["annual_premium_jpy"].astype(int)

    log.info("Loaded %s rows from database.", f"{len(df):,}")
    return df


def is_db_available() -> bool:
    """Return True if the DB is reachable and the table exists."""
    try:
        conn = _get_conn()
        with conn.cursor() as cur:
            cur.execute(
                "SELECT 1 FROM information_schema.tables "
                "WHERE table_name = 'japan_auto_policies'"
            )
            exists = cur.fetchone() is not None
        conn.close()
        return exists
    except Exception:
        return False
