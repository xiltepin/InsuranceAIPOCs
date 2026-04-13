"""
predictor.py
Approach 1 — synthetic/rf_only
Approach 2 — excel_only
Approach 3 — rf_only (trained on excel data)
Approach 4 — hybrid (default)
"""
import pickle
from pathlib import Path
import pandas as pd
from .excel_reader import load_all_factors, excel_calculate_premium

MODEL_PATH = Path(__file__).parent.parent / "models" / "rf_artifacts.pkl"
EXCEL_PATH = Path(__file__).parent.parent / "data"   / "japan_auto_rating_manual.xlsx"

_artifacts     = None
_excel_factors = None

KM_MID = {
    "〜5,000": 3000, "5,001〜10,000": 7500,
    "10,001〜15,000": 12500, "15,001〜20,000": 17500, "20,001〜": 25000,
}


def _load_model():
    global _artifacts
    if _artifacts is None:
        with open(MODEL_PATH, "rb") as f:
            _artifacts = pickle.load(f)
    return _artifacts


def _load_excel():
    global _excel_factors
    if _excel_factors is None and EXCEL_PATH.exists():
        _excel_factors = load_all_factors(EXCEL_PATH)
    return _excel_factors


def is_model_ready():  return MODEL_PATH.exists()
def is_excel_ready():  return EXCEL_PATH.exists()


def _excel_risk_tier(inputs: dict, excel_result: dict) -> str:
    """
    Multi-factor risk scoring for Excel mode.
    The Excel workbook has no accident/violation tables, so we compute
    a risk score from all available driver & policy attributes.
    Returns the deterministic tier label (no probabilities — Excel is not probabilistic).
    """
    score = 0.0  # 0 = safest, 100 = most dangerous

    # --- Accident history (heaviest weight: 0-60 pts) ---
    accidents  = int(inputs.get("num_accidents", 0))
    score += min(accidents * 15, 60)

    # --- Violations (0-18 pts) ---
    violations = int(inputs.get("num_violations", 0))
    score += min(violations * 6, 18)

    # --- Premium level as proxy for vehicle/coverage risk (0-12 pts) ---
    prem = excel_result["annual_premium_jpy"]
    if   prem >= 250000: score += 12
    elif prem >= 180000: score += 9
    elif prem >= 120000: score += 6
    elif prem >= 80000:  score += 3

    # --- NCD grade (grade 1-5 = penalty zone → more risk) (0-6 pts) ---
    ncd = int(inputs.get("ncd_grade", 6))
    if   ncd <= 2:  score += 6
    elif ncd <= 5:  score += 4
    elif ncd <= 8:  score += 2

    # --- Driver experience (0-4 pts) ---
    years = int(inputs.get("years_licensed", 10))
    age   = int(inputs.get("driver_age", 35))
    if years < 3:              score += 2
    if age < 25:               score += 2

    # --- Map score to tier ---
    if   score >= 45:  tier = "Very High"
    elif score >= 25:  tier = "High"
    elif score >= 10:  tier = "Medium"
    else:              tier = "Low"

    return tier


def predict(inputs: dict, mode: str = "hybrid") -> dict:
    ef = _load_excel()

    excel_result = None
    if ef and mode in ("excel_only", "hybrid"):
        excel_result = excel_calculate_premium(inputs, ef)

    if mode == "excel_only":
        tier = _excel_risk_tier(inputs, excel_result)
        return {
            **excel_result,
            "mode":               "excel_only",
            "risk_tier":          tier,
            "risk_probabilities": {},
            "excel_breakdown": {
                "bi_premium":        excel_result["bi_premium"],
                "pd_premium":        excel_result["pd_premium"],
                "vehicle_premium":   excel_result["vehicle_premium"],
                "passenger_premium": excel_result["passenger_premium"],
                "ncd_grade":         excel_result["ncd_grade"],
                "vehicle_class":     excel_result["vehicle_class"],
            },
        }

    arts = _load_model()
    df = pd.DataFrame([_to_rf_features(inputs)])
    for col, le in arts["feature_encoders"].items():
        if col in df.columns:
            try:
                df[col] = le.transform(df[col].astype(str))
            except ValueError:
                df[col] = le.transform([le.classes_[0]])[0]

    X = df[arts["feature_names"]]

    tier_idx    = arts["classifier"].predict(X)[0]
    tier_proba  = arts["classifier"].predict_proba(X)[0]
    tier_label  = arts["tier_encoder"].inverse_transform([tier_idx])[0]
    tier_classes = arts["tier_encoder"].classes_.tolist()
    rf_premium  = float(arts["regressor"].predict(X)[0])

    if mode == "rf_only" or not excel_result:
        return {
            "mode":                "rf_only",
            "risk_tier":           tier_label,
            "risk_probabilities":  dict(zip(tier_classes,
                                           [round(float(p), 4) for p in tier_proba])),
            "annual_premium_jpy":  round(rf_premium),
            "monthly_premium_jpy": round(rf_premium / 12),
        }

    # Approach 4 — Hybrid blend
    rf_confidence = float(max(tier_proba))
    rf_weight     = min(0.40, 0.30 + (rf_confidence - 0.5) * 0.20)
    exc_weight    = 1.0 - rf_weight
    blended       = excel_result["annual_premium_jpy"] * exc_weight + rf_premium * rf_weight

    return {
        "mode":                "hybrid",
        "risk_tier":           tier_label,
        "risk_probabilities":  dict(zip(tier_classes,
                                       [round(float(p), 4) for p in tier_proba])),
        "rf_confidence":       round(rf_confidence, 4),
        "excel_premium_jpy":   excel_result["annual_premium_jpy"],
        "rf_premium_jpy":      round(rf_premium),
        "annual_premium_jpy":  round(blended),
        "monthly_premium_jpy": round(blended / 12),
        "excel_breakdown": {
            "bi_premium":          excel_result["bi_premium"],
            "pd_premium":          excel_result["pd_premium"],
            "vehicle_premium":     excel_result["vehicle_premium"],
            "passenger_premium":   excel_result["passenger_premium"],
            "ncd_grade":           excel_result["ncd_grade"],
            "vehicle_class":       excel_result["vehicle_class"],
        },
        "blend_weights": {"excel": round(exc_weight, 3), "rf": round(rf_weight, 3)},
    }


def _to_rf_features(inputs):
    return {
        "ncd_grade":            int(inputs.get("ncd_grade", 6)),
        "annual_km":            KM_MID.get(inputs.get("annual_km_band", "10,001〜15,000"), 12500),
        "driver_age":           int(inputs.get("driver_age", 35)),
        "num_accidents":        int(inputs.get("num_accidents", 0)),
        "num_violations":       int(inputs.get("num_violations", 0)),
        "years_licensed":       int(inputs.get("years_licensed", 10)),
        "age_condition":        inputs.get("age_condition", "26+"),
        "prefecture_code":      str(inputs.get("prefecture_code", "13")).zfill(2),
        "vehicle_rating_class": str(inputs.get("vehicle_rating_class", 5)),
        "driver_restriction":   inputs.get("driver_restriction", "none"),
        "annual_km_band":       inputs.get("annual_km_band", "10,001〜15,000"),
    }


def get_model_info():
    arts = _load_model()
    return {
        "training_samples":   arts["training_samples"],
        "trained_with_excel": arts.get("trained_with_excel", False),
        "excel_loaded":       is_excel_ready(),
        "feature_names":      arts["feature_names"],
        "metrics":            arts["metrics"],
        "feature_importance": arts["feature_importance"],
    }


def reload():
    global _artifacts, _excel_factors
    _artifacts = _excel_factors = None
