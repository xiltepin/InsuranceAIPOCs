import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Literal

from ml.predictor import predict, get_model_info, is_model_ready, reload_model
from ml.trainer import train_models
from ml.data_generator import generate_auto_insurance_data

app = FastAPI(
    title="Auto Insurance Rating Engine",
    description="Random Forest powered risk scoring and premium estimation",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class RatingRequest(BaseModel):
    age: int = Field(..., ge=18, le=80, description="Driver age")
    driving_experience: int = Field(..., ge=0, le=60, description="Years driving")
    num_accidents: int = Field(..., ge=0, le=5, description="Accidents (last 5 yrs)")
    num_violations: int = Field(..., ge=0, le=5, description="Traffic violations (last 5 yrs)")
    credit_score: int = Field(..., ge=300, le=850, description="Credit score")
    marital_status: Literal["single", "married", "divorced"]
    vehicle_age: int = Field(..., ge=0, le=25, description="Vehicle age in years")
    vehicle_type: Literal["sedan", "suv", "truck", "sports", "minivan"]
    annual_mileage: int = Field(..., ge=3000, le=50000, description="Annual km driven")
    safety_rating: int = Field(..., ge=1, le=5, description="NHTSA safety rating")
    location_risk: Literal["rural", "suburban", "urban"]
    coverage_type: Literal["liability", "comprehensive", "full"]


class TrainRequest(BaseModel):
    n_samples: int = Field(default=10000, ge=1000, le=100000)


@app.get("/health")
def health():
    return {"status": "ok", "model_ready": is_model_ready()}


@app.post("/predict")
def rate_policy(req: RatingRequest):
    if not is_model_ready():
        raise HTTPException(
            status_code=503,
            detail="Model not trained yet. POST to /train first.",
        )
    return predict(req.model_dump())


@app.post("/train")
def train(req: TrainRequest = TrainRequest()):
    df = generate_auto_insurance_data(req.n_samples)
    artifacts = train_models(df)
    reload_model()
    metrics = artifacts["metrics"]
    return {
        "message": "Training complete",
        "training_samples": req.n_samples,
        "classification_accuracy": round(metrics["classification"]["accuracy"], 4),
        "regression_r2": round(metrics["regression"]["r2"], 4),
        "regression_mae": round(metrics["regression"]["mae"], 2),
    }


@app.get("/model/info")
def model_info():
    if not is_model_ready():
        raise HTTPException(status_code=503, detail="Model not trained yet.")
    return get_model_info()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
