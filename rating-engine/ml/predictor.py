import pickle
from pathlib import Path

import pandas as pd

MODEL_PATH = Path(__file__).parent.parent / "models" / "rf_artifacts.pkl"

_artifacts: dict | None = None


def _load() -> dict:
    global _artifacts
    if _artifacts is None:
        with open(MODEL_PATH, "rb") as f:
            _artifacts = pickle.load(f)
    return _artifacts


def is_model_ready() -> bool:
    return MODEL_PATH.exists()


def predict(input_data: dict) -> dict:
    arts = _load()
    df = pd.DataFrame([input_data])

    for col, le in arts["feature_encoders"].items():
        df[col] = le.transform(df[col].astype(str))

    X = df[arts["feature_names"]]

    tier_idx = arts["classifier"].predict(X)[0]
    tier_proba = arts["classifier"].predict_proba(X)[0]
    tier_label = arts["tier_encoder"].inverse_transform([tier_idx])[0]
    tier_classes = arts["tier_encoder"].classes_.tolist()

    annual_premium = float(arts["regressor"].predict(X)[0])

    return {
        "risk_tier": tier_label,
        "risk_probabilities": {
            cls: round(float(p), 4)
            for cls, p in zip(tier_classes, tier_proba)
        },
        "annual_premium": round(annual_premium, 2),
        "monthly_premium": round(annual_premium / 12, 2),
    }


def get_model_info() -> dict:
    arts = _load()
    return {
        "training_samples": arts["training_samples"],
        "feature_names": arts["feature_names"],
        "metrics": arts["metrics"],
        "feature_importance": arts["feature_importance"],
    }


def reload_model() -> None:
    """Force-reload model from disk (after retraining)."""
    global _artifacts
    _artifacts = None
    _load()
