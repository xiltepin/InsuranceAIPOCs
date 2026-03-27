import os
import pickle
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.metrics import (
    classification_report,
    mean_absolute_error,
    mean_squared_error,
    r2_score,
)
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder

MODEL_DIR = Path(__file__).parent.parent / "models"

CATEGORICAL_FEATURES = ["marital_status", "vehicle_type", "location_risk", "coverage_type"]
NUMERICAL_FEATURES = [
    "age", "driving_experience", "num_accidents", "num_violations",
    "credit_score", "vehicle_age", "annual_mileage", "safety_rating",
]
ALL_FEATURES = NUMERICAL_FEATURES + CATEGORICAL_FEATURES


def encode_features(
    df: pd.DataFrame,
    encoders: dict | None = None,
    fit: bool = True,
) -> tuple[pd.DataFrame, dict]:
    df = df.copy()
    if encoders is None:
        encoders = {}
    for col in CATEGORICAL_FEATURES:
        if fit:
            le = LabelEncoder()
            df[col] = le.fit_transform(df[col].astype(str))
            encoders[col] = le
        else:
            df[col] = encoders[col].transform(df[col].astype(str))
    return df[ALL_FEATURES], encoders


def train_models(df: pd.DataFrame) -> dict:
    MODEL_DIR.mkdir(parents=True, exist_ok=True)

    X, encoders = encode_features(df, fit=True)

    tier_encoder = LabelEncoder()
    y_class = tier_encoder.fit_transform(df["risk_tier"].astype(str))
    y_reg = df["annual_premium"].values

    X_train, X_test, yc_train, yc_test, yr_train, yr_test = train_test_split(
        X, y_class, y_reg, test_size=0.2, random_state=42
    )

    # --- Classifier ---
    clf = RandomForestClassifier(
        n_estimators=150, max_depth=14, min_samples_split=5,
        min_samples_leaf=2, random_state=42, n_jobs=-1,
    )
    clf.fit(X_train, yc_train)

    # --- Regressor ---
    reg = RandomForestRegressor(
        n_estimators=150, max_depth=14, min_samples_split=5,
        min_samples_leaf=2, random_state=42, n_jobs=-1,
    )
    reg.fit(X_train, yr_train)

    # --- Evaluation ---
    yc_pred = clf.predict(X_test)
    clf_report = classification_report(
        yc_test, yc_pred,
        target_names=tier_encoder.classes_,
        output_dict=True,
    )

    yr_pred = reg.predict(X_test)
    reg_metrics = {
        "mae": float(mean_absolute_error(yr_test, yr_pred)),
        "rmse": float(np.sqrt(mean_squared_error(yr_test, yr_pred))),
        "r2": float(r2_score(yr_test, yr_pred)),
    }

    # --- Feature importance ---
    feature_importance = {
        "classification": dict(zip(ALL_FEATURES, clf.feature_importances_.tolist())),
        "regression": dict(zip(ALL_FEATURES, reg.feature_importances_.tolist())),
    }

    artifacts = {
        "classifier": clf,
        "regressor": reg,
        "feature_encoders": encoders,
        "tier_encoder": tier_encoder,
        "feature_names": ALL_FEATURES,
        "metrics": {
            "classification": clf_report,
            "regression": reg_metrics,
        },
        "feature_importance": feature_importance,
        "training_samples": len(df),
    }

    with open(MODEL_DIR / "rf_artifacts.pkl", "wb") as f:
        pickle.dump(artifacts, f)

    print(f"✅ Training complete ({len(df):,} samples)")
    print(f"   Classification accuracy : {clf_report['accuracy']:.3f}")
    print(f"   Regression R²           : {reg_metrics['r2']:.3f}")
    print(f"   Regression MAE          : ${reg_metrics['mae']:.2f}")
    print(f"   Model saved to          : {MODEL_DIR / 'rf_artifacts.pkl'}")

    return artifacts
