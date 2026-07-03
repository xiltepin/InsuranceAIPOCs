# Insurance Risk Assessment POC - System Architecture Blueprint

## System Overview
This project is a Proof of Concept (POC) for an Insurance Risk Assessment platform. It integrates Optical Character Recognition (OCR) for document processing with real-time IoT data monitoring and a dynamic pricing engine.

## Containerization & Infrastructure
The entire application stack is fully containerized and runs within a Docker environment (hosted within an LXC container on Proxmox). 
- Services communicate over a bridged Docker network.
- Environment variables (`.env`) control cross-container communication (e.g., `RATING_ENGINE_URL=http://rating-engine:8000`).
- Strict environment path handling is enforced (e.g., the NestJS backend must dynamically resolve local paths like `python3` instead of inheriting forwarded Windows `PYTHON_PATH` variables via SSH).

## Component Breakdown

### 1. Frontend (`/frontend`)
- **Technology:** Angular (Standalone Components)
- **Port:** `4200`
- **Key Features:**
  - **OCR Auto:** Image upload and processing interface for insurance documents.
  - **Risk Assessment Dashboard:** Displays driver profiles, dynamically calculated risk scores, and recommended premiums.
  - **IoT Monitor:** Real-time monitoring of vehicle telemetry (speed, RPM, harsh braking, etc.).
- **Integration:** Communicates with the NestJS backend via HTTP REST endpoints (`http://localhost:3000`).

### 2. Backend (`/backend`)
- **Technology:** NestJS (Node.js)
- **Port:** `3000`
- **Key Modules:**
  - **OCR Integration:** Calls local PaddleOCR Python scripts for document analysis.
  - **Risk Assessment Service:** Calculates comprehensive risk scores based on driver profiles (age, experience, vehicle type) and driving behaviors.
  - **IoT Integration Service:** Handles fetching and processing of IoT device data (currently using mock data, prepared for real OBD-II API integration).
  - **Pricing Engine Service:** Calculates dynamic premiums based on base rates and calculated risk multipliers.

### 3. Rating & Machine Learning Engine (`/rating-engine`)
- **Technology:** Python
- **Key Components:**
  - **API:** Exposes ML model endpoints for risk and pricing predictions.
  - **ML/Models:** Contains logic for training (`train.py`) and serving models.
  - **Data Handling:** Manages datasets (`data/`) and database interactions (`db/`) for model training and evaluation.
- **Integration:** Expected to work in tandem with the NestJS backend to provide advanced analytics for the pricing engine.

### 4. OCR Engine (`/backend/OCR`)
- **Technology:** Python (PaddleOCR)
- **Functionality:** Extracts text and structural data from uploaded insurance document images, converting them into structured JSON format (via `paddleocr_to_json.py`).

## Data Flow & Integration
1. **User Interaction:** The user interacts with the Angular frontend to upload documents or monitor risk dashboards.
2. **Backend Processing:** 
   - For OCR, the NestJS backend triggers the local PaddleOCR Python script and processes the output.
   - For Risk Assessment, the backend computes scores locally and/or queries the Python `rating-engine` for advanced predictions.
3. **IoT Telemetry:** Real-time data is ingested by the IoT Integration Service and fed into the Risk Assessment Service to dynamically update driving behavior metrics.
4. **Response:** Aggregated and processed data (risk scores, IoT metrics, OCR results) is sent back to the frontend for visualization.

## Future Enhancements
- Link OCR-extracted data (e.g., driver age, vehicle type) directly to the risk assessment pipeline for automated profiling.
- Replace mock IoT data with a live OBD-II API or WebSocket streams for real-time updates.
- Implement comprehensive database persistence for driver profiles, historical risk scores, and long-term IoT metrics.
