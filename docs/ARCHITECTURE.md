# Insurance Risk Assessment POC - System Architecture Blueprint

## Git Workflow Guidelines
- **Branching Strategy:** Work exclusively in feature branches scoped to the current issue. **CRITICAL:** Before beginning any work, agents must *always* create and checkout a new branch from `main` named after the issue (e.g., `git checkout -b issue-5 main`). Never make changes on `main` or without an active issue branch.
- **Merge Policy:** When an issue is fully completed, commit all changes. Never merge a branch until unit testing has been finalized. This requires human interaction to confirm. When human interaction confirmed no issues, then proceed to merge the issue branch back into `main` (e.g., `git checkout main && git merge issue-2 && git push origin main`).
- **Issue Tracking & Verification:** When working on an issue, agents must verify if a corresponding issue markdown file exists in the `docs/Issues` directory (e.g., if working on `Issue-1`, there should be `docs/Issues/Issue-1.md`). 
  - Agents must update this file with the latest status.
  - If there are issue findings, list what has been found in the document.
  - When a human has verified the completion of unit testing, the agent should flag the issue as completed in the document.

## System Overview
This project is a Proof of Concept (POC) for an Insurance Risk Assessment platform. It integrates Optical Character Recognition (OCR) for document processing with real-time IoT data monitoring and a dynamic pricing engine.

## Containerization & Infrastructure
The entire application stack is fully containerized and orchestrated via `docker-compose.yml`. It defines four main services communicating over a bridged Docker network:

- **Postgres Database (`postgres`):** Runs `postgres:16`. Data is persisted via a named Docker volume (`pgdata`). Healthchecks are enabled to ensure DB readiness. Port 5432 is exposed to the host as 5433 to avoid conflicts.
- **Frontend Container (`frontend`):** A multi-stage build. 
  - *Stage 1:* Node.js 20 Alpine handles dependency installation and builds the Angular application.
  - *Stage 2:* NGINX Alpine serves the compiled static files (`/usr/share/nginx/html`). NGINX is configured to support SPA routing (redirecting to `index.html`), caching strategies, and reverse proxies `/api/` traffic directly to the `backend` container on port 3000. It also uses a runtime environment variable script (`40-env.sh`).
- **Backend Container (`backend`):** Based on `node:20-slim`. It uniquely acts as a hybrid Node.js and Python environment:
  - Installs system libraries and Python 3 to support local PaddleOCR execution.
  - Manages specific Python dependencies (`paddlepaddle==2.6.2`, `numpy<2.0`) to avoid ABI compatibility issues.
  - Compiles the NestJS application and exposes port 3000. Connects to `postgres`, `rating-engine`, and optionally `OLLAMA` via environment variables.
- **Rating Engine (`rating-engine`):** A Python-based service that exposes an API on port 8000 for ML predictions, connecting directly to the Postgres database.

Environment variables (`.env`) control cross-container communication (e.g., `RATING_ENGINE_URL=http://rating-engine:8000`). Strict environment path handling is enforced (e.g., the NestJS backend must dynamically resolve local paths like `python3` instead of inheriting forwarded Windows `PYTHON_PATH` variables via SSH). Docker Compose `develop.watch` logic is implemented for rapid local rebuilds and hot-reloads across services.

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
