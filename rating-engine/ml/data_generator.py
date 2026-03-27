import numpy as np
import pandas as pd

np.random.seed(42)

VEHICLE_TYPES = ["sedan", "suv", "truck", "sports", "minivan"]
MARITAL_STATUSES = ["single", "married", "divorced"]
LOCATION_RISKS = ["rural", "suburban", "urban"]
COVERAGE_TYPES = ["liability", "comprehensive", "full"]
RISK_TIERS = ["Low", "Medium", "High", "Very High"]


def generate_auto_insurance_data(n_samples: int = 10000) -> pd.DataFrame:
    """Generate synthetic auto insurance policy data with realistic correlations."""
    rng = np.random.default_rng(42)

    age = rng.integers(18, 81, n_samples)
    driving_experience = np.clip(
        age - 16 - rng.integers(0, 4, n_samples), 0, 60
    ).astype(int)

    num_accidents = rng.choice([0, 1, 2, 3, 4, 5], n_samples,
                                p=[0.65, 0.20, 0.09, 0.04, 0.01, 0.01])
    num_violations = rng.choice([0, 1, 2, 3, 4, 5], n_samples,
                                 p=[0.60, 0.22, 0.11, 0.05, 0.01, 0.01])

    credit_score = rng.normal(680, 100, n_samples).clip(300, 850).astype(int)
    marital_status = rng.choice(MARITAL_STATUSES, n_samples, p=[0.40, 0.45, 0.15])

    vehicle_age = rng.integers(0, 26, n_samples)
    vehicle_type = rng.choice(VEHICLE_TYPES, n_samples, p=[0.35, 0.30, 0.15, 0.12, 0.08])
    annual_mileage = rng.normal(15000, 5000, n_samples).clip(3000, 50000).astype(int)
    safety_rating = rng.choice([1, 2, 3, 4, 5], n_samples, p=[0.05, 0.10, 0.25, 0.35, 0.25])

    location_risk = rng.choice(LOCATION_RISKS, n_samples, p=[0.20, 0.50, 0.30])
    coverage_type = rng.choice(COVERAGE_TYPES, n_samples, p=[0.30, 0.35, 0.35])

    df = pd.DataFrame({
        "age": age,
        "driving_experience": driving_experience,
        "num_accidents": num_accidents,
        "num_violations": num_violations,
        "credit_score": credit_score,
        "marital_status": marital_status,
        "vehicle_age": vehicle_age,
        "vehicle_type": vehicle_type,
        "annual_mileage": annual_mileage,
        "safety_rating": safety_rating,
        "location_risk": location_risk,
        "coverage_type": coverage_type,
    })

    risk_score = _compute_risk_score(df, rng, n_samples)
    df["risk_tier"] = _assign_risk_tier(risk_score)
    df["annual_premium"] = _compute_premium(df, risk_score, rng, n_samples)

    return df


def _compute_risk_score(df: pd.DataFrame, rng, n: int) -> np.ndarray:
    s = np.zeros(n)

    s += np.where(df["age"] < 25, 2.0, 0)
    s += np.where(df["age"] > 70, 1.5, 0)
    s += np.where((df["age"] >= 25) & (df["age"] <= 70), -0.5, 0)

    s -= df["driving_experience"].values * 0.05
    s += df["num_accidents"].values * 3.0
    s += df["num_violations"].values * 1.5

    s -= (df["credit_score"].values - 300) / 550 * 2.0

    s += np.where(df["vehicle_type"] == "sports", 1.5, 0)
    s += np.where(df["vehicle_type"] == "truck", 0.5, 0)
    s += df["vehicle_age"].values * 0.05
    s -= (df["safety_rating"].values - 1) * 0.3
    s += (df["annual_mileage"].values - 3000) / 47000 * 1.5

    s += np.where(df["location_risk"] == "urban", 1.0, 0)
    s += np.where(df["location_risk"] == "rural", -0.5, 0)
    s += np.where(df["marital_status"] == "single", 0.5, 0)
    s += np.where(df["marital_status"] == "married", -0.3, 0)

    s += rng.normal(0, 0.5, n)
    return s


def _assign_risk_tier(risk_score: np.ndarray) -> pd.Series:
    p33, p66, p85 = np.percentile(risk_score, [33, 66, 85])
    return pd.cut(
        risk_score,
        bins=[-np.inf, p33, p66, p85, np.inf],
        labels=RISK_TIERS,
    )


def _compute_premium(df: pd.DataFrame, risk_score: np.ndarray, rng, n: int) -> np.ndarray:
    base = np.where(df["coverage_type"] == "liability", 800,
           np.where(df["coverage_type"] == "comprehensive", 1200, 1800))
    risk_norm = (risk_score - risk_score.min()) / (risk_score.max() - risk_score.min())
    multiplier = 0.5 + risk_norm * 2.5
    premium = (base * multiplier + rng.normal(0, 50, n)).clip(200, 8000)
    return np.round(premium, 2)
