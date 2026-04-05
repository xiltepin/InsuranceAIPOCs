import pickle
import logging
from pathlib import Path
from typing import Generator

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.metrics import classification_report, mean_absolute_error, r2_score
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder

log = logging.getLogger(__name__)

MODEL_DIR    = Path(__file__).parent.parent / "models"
CATEGORICAL  = ["age_condition","prefecture_code","vehicle_rating_class",
                "driver_restriction","annual_km_band"]
NUMERICAL    = ["ncd_grade","annual_km","driver_age","num_accidents",
                "num_violations","years_licensed"]
ALL_FEATURES = NUMERICAL + CATEGORICAL
N_TREES      = 150
CHUNK        = 10


def encode(df, encoders=None, fit=True):
    df = df.copy()
    if encoders is None:
        encoders = {}
    for col in CATEGORICAL:
        if fit:
            le = LabelEncoder()
            df[col] = le.fit_transform(df[col].astype(str))
            encoders[col] = le
        else:
            df[col] = encoders[col].transform(df[col].astype(str))
    return df[ALL_FEATURES], encoders


def train_models(df: pd.DataFrame, source: str = "synthetic") -> dict:
    """Blocking train — used by non-streaming /train endpoint."""
    artifacts = None
    for item in train_models_streaming(df, source):
        if item.get("done"):
            artifacts = item["artifacts"]
    return artifacts


def train_models_streaming(df: pd.DataFrame, source: str = "synthetic") -> Generator:
    """
    Generator that yields real progress dicts as trees are built.
    Uses warm_start so each chunk of 10 trees is a real training step.

    Yields: {"phase": str, "pct": int}
    Final:  {"phase": "Complete", "pct": 100, "done": True,
             "result": {...metrics...}, "artifacts": {...}}
    """
    MODEL_DIR.mkdir(parents=True, exist_ok=True)

    yield {"phase": "Encoding features...", "pct": 8}

    X, encoders = encode(df, fit=True)
    tier_enc = LabelEncoder()
    y_cls = tier_enc.fit_transform(df["risk_tier"].astype(str))
    y_reg = df["annual_premium_jpy"].values

    X_tr, X_te, yc_tr, yc_te, yr_tr, yr_te = train_test_split(
        X, y_cls, y_reg, test_size=0.2, random_state=42
    )

    # ── Classifier ──────────────────────────────────────────────────────
    yield {"phase": f"Classifier: 0/{N_TREES} trees", "pct": 9}

    clf = RandomForestClassifier(
        n_estimators=CHUNK, warm_start=True, max_depth=14,
        min_samples_split=5, min_samples_leaf=2,
        random_state=42, n_jobs=None,
    )
    clf.fit(X_tr, yc_tr)
    yield {"phase": f"Classifier: {CHUNK}/{N_TREES} trees", "pct": 11}

    for n in range(CHUNK * 2, N_TREES + 1, CHUNK):
        clf.n_estimators = n
        clf.fit(X_tr, yc_tr)
        pct = 11 + int(((n - CHUNK) / (N_TREES - CHUNK)) * 38)
        yield {"phase": f"Classifier: {n}/{N_TREES} trees", "pct": pct}

    yield {"phase": "Evaluating classifier...", "pct": 50}
    yc_pred    = clf.predict(X_te)
    clf_report = classification_report(
        yc_te, yc_pred, target_names=tier_enc.classes_, output_dict=True
    )

    # ── Regressor ───────────────────────────────────────────────────────
    yield {"phase": f"Regressor: 0/{N_TREES} trees", "pct": 51}

    reg = RandomForestRegressor(
        n_estimators=CHUNK, warm_start=True, max_depth=14,
        min_samples_split=5, min_samples_leaf=2,
        random_state=42, n_jobs=None,
    )
    reg.fit(X_tr, yr_tr)
    yield {"phase": f"Regressor: {CHUNK}/{N_TREES} trees", "pct": 53}

    for n in range(CHUNK * 2, N_TREES + 1, CHUNK):
        reg.n_estimators = n
        reg.fit(X_tr, yr_tr)
        pct = 53 + int(((n - CHUNK) / (N_TREES - CHUNK)) * 37)
        yield {"phase": f"Regressor: {n}/{N_TREES} trees", "pct": pct}

    yield {"phase": "Evaluating regressor...", "pct": 91}
    yr_pred     = reg.predict(X_te)
    reg_metrics = {
        "mae": float(mean_absolute_error(yr_te, yr_pred)),
        "r2":  float(r2_score(yr_te, yr_pred)),
    }

    yield {"phase": "Saving rf_artifacts.pkl...", "pct": 95}

    artifacts = {
        "classifier":         clf,
        "regressor":          reg,
        "feature_encoders":   encoders,
        "tier_encoder":       tier_enc,
        "feature_names":      ALL_FEATURES,
        "metrics":            {"classification": clf_report, "regression": reg_metrics},
        "feature_importance": {
            "classification": dict(zip(ALL_FEATURES, clf.feature_importances_.tolist())),
            "regression":     dict(zip(ALL_FEATURES, reg.feature_importances_.tolist())),
        },
        "training_samples":   len(df),
        "trained_with_excel": False,
        "training_source":    source,
    }

    with open(MODEL_DIR / "rf_artifacts.pkl", "wb") as f:
        pickle.dump(artifacts, f)

    result = {
        "message":                 "Training complete",
        "training_samples":        len(df),
        "training_source":         source,
        "classification_accuracy": round(clf_report["accuracy"], 4),
        "regression_r2":           round(reg_metrics["r2"], 4),
        "regression_mae_jpy":      round(reg_metrics["mae"]),
    }

    print(f"✅  Training complete ({len(df):,} samples — source: {source})")
    print(f"    Accuracy {clf_report['accuracy']:.3f}  R² {reg_metrics['r2']:.3f}  MAE ¥{reg_metrics['mae']:,.0f}")

    yield {"phase": "Complete", "pct": 100, "done": True,
           "result": result, "artifacts": artifacts}
