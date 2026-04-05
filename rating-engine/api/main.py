import sys
import json
import asyncio
import threading
import queue as q_module
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from typing import Literal
import shutil

from ml.predictor import predict, get_model_info, is_model_ready, is_excel_ready, reload
from ml.trainer import train_models, train_models_streaming
from ml.data_generator import generate_auto_insurance_data
from ml.excel_reader import load_all_factors
from ml.db_loader import load_training_data, is_db_available, get_total_row_count

DATA_DIR   = Path(__file__).parent.parent / "data"
DATA_DIR.mkdir(exist_ok=True)
EXCEL_DEST = DATA_DIR / "japan_auto_rating_manual.xlsx"

app = FastAPI(
    title="Japan Auto Insurance Hybrid Rating Engine",
    description="Excel actuarial factors + Random Forest — replaces Drools",
    version="2.0.0-JP",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class RatingRequest(BaseModel):
    ncd_grade:            int   = Field(6,    ge=1,  le=20)
    age_condition:        Literal["all","21+","26+","30+","35+"] = "26+"
    prefecture_code:      str   = Field("13")
    vehicle_rating_class: int   = Field(5,    ge=1,  le=15)
    driver_restriction:   Literal["none","family","spouse","self"] = "none"
    annual_km_band:       Literal["〜5,000","5,001〜10,000","10,001〜15,000",
                                  "15,001〜20,000","20,001〜"] = "10,001〜15,000"
    driver_age:           int   = Field(35,   ge=18, le=75)
    num_accidents:        int   = Field(0,    ge=0,  le=4)
    num_violations:       int   = Field(0,    ge=0,  le=3)
    years_licensed:       int   = Field(10,   ge=0,  le=57)
    mode: Literal["hybrid","excel_only","rf_only"] = "hybrid"


class TrainRequest(BaseModel):
    n_samples: int = Field(default=10000, ge=1000, le=5000000)
    source: Literal["synthetic","database"] = "synthetic"


@app.get("/health")
def health():
    return {
        "status":       "ok",
        "model_ready":  is_model_ready(),
        "excel_loaded": is_excel_ready(),
    }


@app.post("/predict")
def rate_policy(req: RatingRequest):
    if req.mode != "excel_only" and not is_model_ready():
        raise HTTPException(503, "Model not trained yet. POST to /train first.")
    if req.mode == "excel_only" and not is_excel_ready():
        raise HTTPException(503, "Excel manual not uploaded.")
    return predict(req.model_dump(), mode=req.mode)


@app.post("/train")
def train(req: TrainRequest):
    """Blocking train endpoint — kept for CLI/curl use."""
    if req.source == "database":
        if not is_db_available():
            raise HTTPException(503, "Database not available.")
        df = load_training_data(n_samples=req.n_samples)
        source_label = "database"
    else:
        ef = load_all_factors(EXCEL_DEST) if EXCEL_DEST.exists() else None
        df = generate_auto_insurance_data(req.n_samples, excel_factors=ef)
        source_label = "synthetic" + ("_excel_anchored" if ef else "")

    arts = train_models(df, source=source_label)
    reload()
    m = arts["metrics"]
    return {
        "message":                 "Training complete",
        "training_samples":        len(df),
        "training_source":         source_label,
        "classification_accuracy": round(m["classification"]["accuracy"], 4),
        "regression_r2":           round(m["regression"]["r2"], 4),
        "regression_mae_jpy":      round(m["regression"]["mae"]),
    }


@app.get("/train/stream")
async def train_stream(n_samples: int = 10000, source: str = "synthetic"):
    """
    SSE endpoint — streams real training progress as trees are built.
    Uses warm_start: each chunk of 10 trees yields a real progress event.
    """
    progress_q: q_module.Queue = q_module.Queue()

    def run():
        try:
            if source == "database":
                if not is_db_available():
                    progress_q.put({"error": "Database not available", "pct": 0})
                    return
                progress_q.put({"phase": "Querying database...", "pct": 2})
                df = load_training_data(n_samples=n_samples)
                progress_q.put({"phase": f"Loaded {len(df):,} rows from DB", "pct": 7})
            else:
                ef = load_all_factors(EXCEL_DEST) if EXCEL_DEST.exists() else None
                progress_q.put({"phase": "Generating synthetic data...", "pct": 2})
                df = generate_auto_insurance_data(n_samples, excel_factors=ef)
                progress_q.put({"phase": f"Generated {len(df):,} rows", "pct": 7})

            for item in train_models_streaming(df, source=source):
                progress_q.put(item)
                if item.get("done"):
                    reload()

        except Exception as e:
            progress_q.put({"error": str(e), "pct": 0})
        finally:
            progress_q.put(None)

    threading.Thread(target=run, daemon=True).start()

    async def event_gen():
        loop = asyncio.get_event_loop()
        while True:
            def q_get():
                try:
                    return progress_q.get(timeout=5)
                except q_module.Empty:
                    return "__ping__"

            item = await loop.run_in_executor(None, q_get)
            if item == "__ping__":
                yield ": keep-alive\n\n"
                continue

            if item is None:
                break
            # strip non-serialisable artifacts before sending to browser
            safe = {k: v for k, v in item.items() if k != "artifacts"}
            yield f"data: {json.dumps(safe)}\n\n"

    return StreamingResponse(
        event_gen(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.get("/db/status")
def db_status():
    available = is_db_available()
    if not available:
        return {"available": False, "total_rows": 0, "message": "DB not reachable"}
    total = get_total_row_count()
    return {"available": True, "total_rows": total,
            "message": f"{total:,} historical policies available"}


@app.post("/upload-excel")
async def upload_excel(file: UploadFile = File(...)):
    if not file.filename.endswith(".xlsx"):
        raise HTTPException(400, "Only .xlsx files accepted")
    with open(EXCEL_DEST, "wb") as f:
        shutil.copyfileobj(file.file, f)
    try:
        factors = load_all_factors(EXCEL_DEST)
        reload()
        return {"message": "Excel rating manual uploaded",
                "sheets_loaded": {k: len(v) for k, v in factors.items()}}
    except Exception as e:
        EXCEL_DEST.unlink(missing_ok=True)
        raise HTTPException(422, f"Failed to parse Excel: {e}")


@app.get("/model/info")
def model_info():
    if not is_model_ready():
        raise HTTPException(503, "Model not trained yet.")
    return get_model_info()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
