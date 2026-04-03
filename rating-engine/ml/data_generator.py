"""
data_generator.py
Approach 1 (synthetic only) or Approach 3/4 (Excel-anchored).
When excel_factors is provided, premiums are anchored to real actuarial values.
"""
import numpy as np
import pandas as pd

RISK_TIERS = ["Low", "Medium", "High", "Very High"]

NCD_GRADES   = list(range(1, 21))
_NCD_PROB    = np.array([0.02,0.03,0.04,0.04,0.05,0.08,0.07,0.07,0.06,0.06,
                          0.06,0.06,0.06,0.06,0.06,0.06,0.05,0.05,0.04,0.04])
NCD_PROB     = _NCD_PROB / _NCD_PROB.sum()

AGE_CONDS    = ["all","21+","26+","30+","35+"]
_AGE_PROB    = np.array([0.05,0.10,0.30,0.30,0.25])
AGE_PROB     = _AGE_PROB / _AGE_PROB.sum()

PREF_CODES   = [str(i).zfill(2) for i in range(1, 48)]
PREF_WEIGHTS = np.array([1.0,0.6,0.6,0.8,0.5,0.5,0.6,0.9,0.8,0.8,
                          2.5,2.3,5.0,4.5,0.7,0.6,0.7,0.5,0.5,0.6,
                          0.7,0.9,3.5,0.7,0.7,1.2,4.0,2.0,0.7,0.5,
                          0.3,0.3,0.8,0.9,0.6,0.5,0.6,0.6,0.4,2.0,
                          0.5,0.6,0.7,0.5,0.5,0.5,0.5])
PREF_PROB    = PREF_WEIGHTS / PREF_WEIGHTS.sum()

VEH_CLASSES  = [1,3,5,7,9,11,13,15]
_VEH_PROB    = np.array([0.12,0.10,0.25,0.22,0.13,0.08,0.06,0.04])
VEH_PROB     = _VEH_PROB / _VEH_PROB.sum()

DRIVER_RESTR = ["none","family","spouse","self"]
_DR_PROB     = np.array([0.25,0.20,0.35,0.20])
DR_PROB      = _DR_PROB / _DR_PROB.sum()

KM_BANDS     = ["〜5,000","5,001〜10,000","10,001〜15,000","15,001〜20,000","20,001〜"]
_KM_PROB     = np.array([0.10,0.25,0.35,0.20,0.10])
KM_PROB      = _KM_PROB / _KM_PROB.sum()
KM_MID       = [3000,7500,12500,17500,25000]


def generate_auto_insurance_data(n_samples=10000, excel_factors=None):
    rng = np.random.default_rng(42)

    ncd   = rng.choice(NCD_GRADES,   n_samples, p=NCD_PROB)
    age_c = rng.choice(AGE_CONDS,    n_samples, p=AGE_PROB)
    pref  = rng.choice(PREF_CODES,   n_samples, p=PREF_PROB)
    vcls  = rng.choice(VEH_CLASSES,  n_samples, p=VEH_PROB)
    dr    = rng.choice(DRIVER_RESTR, n_samples, p=DR_PROB)
    km_b  = rng.choice(KM_BANDS,     n_samples, p=KM_PROB)
    km_v  = np.array([KM_MID[KM_BANDS.index(k)] for k in km_b])

    age    = rng.integers(18, 76, n_samples)
    nacc   = rng.choice([0,1,2,3,4], n_samples, p=[0.70,0.18,0.08,0.03,0.01])
    nviol  = rng.choice([0,1,2,3],   n_samples, p=[0.72,0.18,0.07,0.03])
    ylicen = np.clip(age - 18 - rng.integers(0, 4, n_samples), 0, 57)

    df = pd.DataFrame({
        "ncd_grade":            ncd,
        "age_condition":        age_c,
        "prefecture_code":      pref,
        "vehicle_rating_class": vcls,
        "driver_restriction":   dr,
        "annual_km_band":       km_b,
        "annual_km":            km_v,
        "driver_age":           age,
        "num_accidents":        nacc,
        "num_violations":       nviol,
        "years_licensed":       ylicen,
    })

    if excel_factors:
        premiums = _excel_anchored(df, rng, n_samples, excel_factors)
    else:
        premiums = _statistical(df, rng, n_samples)

    p33, p66, p85 = np.percentile(premiums, [33, 66, 85])
    df["annual_premium_jpy"] = np.round(premiums).astype(int)
    df["risk_tier"] = pd.cut(
        premiums, bins=[-np.inf, p33, p66, p85, np.inf], labels=RISK_TIERS
    )
    return df


def _excel_anchored(df, rng, n, ef):
    """Fast vectorized Excel-anchored premium generation.
    Uses a reference premium for a standard profile, then scales
    statistically — avoids the slow per-row Python loop.
    """
    from .excel_reader import excel_calculate_premium
    ref = excel_calculate_premium({
        "ncd_grade": 6, "age_condition": "26+",
        "prefecture_code": "13", "vehicle_rating_class": 7,
        "driver_restriction": "none"
    }, ef)
    anchor = ref["annual_premium_jpy"]   # e.g. ¥148,000

    # Build a risk score and scale around the anchor
    s = np.zeros(n)
    s += (6 - np.clip(df["ncd_grade"].values, 1, 6)) * 0.4   # NCD discount lowers risk
    s -= np.maximum(df["ncd_grade"].values - 13, 0) * 0.25
    ac_map = {"all": 1.3, "21+": 1.1, "26+": 1.0, "30+": 0.92, "35+": 0.85}
    s += (df["age_condition"].map(ac_map).fillna(1.0).values - 1.0) * 2.5
    s += df["num_accidents"].values * 1.5
    s += df["num_violations"].values * 0.8
    s += (df["vehicle_rating_class"].values - 7) * 0.12
    s += rng.normal(0, 0.4, n)

    norm = (s - s.min()) / max(s.max() - s.min(), 1e-6)
    # Scale: 0.5x anchor (great driver) to 2.0x anchor (very high risk)
    premiums = anchor * (0.5 + norm * 1.5)
    return (premiums * rng.normal(1.0, 0.03, n)).clip(30000, 800000)


def _statistical(df, rng, n):
    s = np.zeros(n)
    s += np.where(df["ncd_grade"] <= 5, (6 - df["ncd_grade"]) * 0.5, 0)
    s -= np.where(df["ncd_grade"] >= 14, (df["ncd_grade"] - 13) * 0.3, 0)
    ac = df["age_condition"].map(
        {"all": 1.3, "21+": 1.1, "26+": 1.0, "30+": 0.92, "35+": 0.85}
    )
    s += (ac - 1.0) * 3
    s += df["num_accidents"] * 1.5
    s += df["num_violations"] * 0.8
    s += (df["vehicle_rating_class"] - 5) * 0.15
    s += rng.normal(0, 0.5, n)
    base  = 150000 + (df["vehicle_rating_class"] * 8000).values
    norm  = (s - s.min()) / (s.max() - s.min())
    return (base * (0.5 + norm * 2.0) + rng.normal(0, 3000, n)).clip(30000, 800000)
