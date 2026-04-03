import pickle
from pathlib import Path
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.metrics import classification_report, mean_absolute_error, r2_score
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder

MODEL_DIR  = Path(__file__).parent.parent / "models"
CATEGORICAL = ["age_condition","prefecture_code","vehicle_rating_class",
               "driver_restriction","annual_km_band"]
NUMERICAL   = ["ncd_grade","annual_km","driver_age","num_accidents",
               "num_violations","years_licensed"]
ALL_FEATURES = NUMERICAL + CATEGORICAL


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


def train_models(df):
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    X, encoders = encode(df, fit=True)
    tier_enc = LabelEncoder()
    y_cls = tier_enc.fit_transform(df["risk_tier"].astype(str))
    y_reg = df["annual_premium_jpy"].values

    X_tr, X_te, yc_tr, yc_te, yr_tr, yr_te = train_test_split(
        X, y_cls, y_reg, test_size=0.2, random_state=42
    )

    clf = RandomForestClassifier(
        n_estimators=150, max_depth=14, min_samples_split=5,
        min_samples_leaf=2, random_state=42, n_jobs=-1,
    )
    clf.fit(X_tr, yc_tr)

    reg = RandomForestRegressor(
        n_estimators=150, max_depth=14, min_samples_split=5,
        min_samples_leaf=2, random_state=42, n_jobs=-1,
    )
    reg.fit(X_tr, yr_tr)

    yc_pred = clf.predict(X_te)
    clf_report = classification_report(
        yc_te, yc_pred, target_names=tier_enc.classes_, output_dict=True
    )
    yr_pred = reg.predict(X_te)
    reg_metrics = {
        "mae": float(mean_absolute_error(yr_te, yr_pred)),
        "r2":  float(r2_score(yr_te, yr_pred)),
    }

    artifacts = {
        "classifier":        clf,
        "regressor":         reg,
        "feature_encoders":  encoders,
        "tier_encoder":      tier_enc,
        "feature_names":     ALL_FEATURES,
        "metrics":           {"classification": clf_report, "regression": reg_metrics},
        "feature_importance": {
            "classification": dict(zip(ALL_FEATURES, clf.feature_importances_.tolist())),
            "regression":     dict(zip(ALL_FEATURES, reg.feature_importances_.tolist())),
        },
        "training_samples":   len(df),
        "trained_with_excel": True,
    }

    with open(MODEL_DIR / "rf_artifacts.pkl", "wb") as f:
        pickle.dump(artifacts, f)

    print(f"✅  Training complete ({len(df):,} samples)")
    print(f"    Classification accuracy : {clf_report['accuracy']:.3f}")
    print(f"    Regression R²           : {reg_metrics['r2']:.3f}")
    print(f"    Regression MAE          : ¥{reg_metrics['mae']:,.0f}")
    return artifacts
