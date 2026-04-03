#!/usr/bin/env python3
import argparse, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))

from ml.data_generator import generate_auto_insurance_data
from ml.trainer import train_models
from ml.excel_reader import load_all_factors

EXCEL_PATH = Path(__file__).parent / "data" / "japan_auto_rating_manual.xlsx"

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--samples", type=int, default=10000)
    args = parser.parse_args()

    ef = None
    if EXCEL_PATH.exists():
        print("📊  Excel rating manual found — using Excel-anchored data (Approach 4)")
        ef = load_all_factors(EXCEL_PATH)
    else:
        print("⚠️   No Excel found — using statistical approximation (Approach 1)")

    print(f"🚗  Generating {args.samples:,} synthetic policies...")
    df = generate_auto_insurance_data(args.samples, excel_factors=ef)
    print(f"    Risk tier distribution:\n{df['risk_tier'].value_counts().to_string()}\n")
    print("🌳  Training Random Forest models...")
    train_models(df)

if __name__ == "__main__":
    main()
