#!/usr/bin/env python3
"""
CLI entrypoint: python train.py [--samples N]
Generates synthetic data and trains both Random Forest models.
"""
import argparse
from ml.data_generator import generate_auto_insurance_data
from ml.trainer import train_models


def main():
    parser = argparse.ArgumentParser(description="Train the RF rating engine models")
    parser.add_argument("--samples", type=int, default=10000,
                        help="Number of synthetic policies to generate (default: 10000)")
    args = parser.parse_args()

    print(f"🚗  Generating {args.samples:,} synthetic auto insurance policies...")
    df = generate_auto_insurance_data(args.samples)
    print(f"    Dataset shape : {df.shape}")
    print(f"    Risk tier dist:\n{df['risk_tier'].value_counts().to_string()}\n")

    print("🌳  Training Random Forest models...")
    train_models(df)


if __name__ == "__main__":
    main()
