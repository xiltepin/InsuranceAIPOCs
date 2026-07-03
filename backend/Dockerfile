FROM node:20-slim

# Install Python 3, pip, and system dependencies needed by PaddleOCR / PyMuPDF
RUN apt-get update -y && apt-get install -y \
    openssl \
    python3 \
    python3-pip \
    python3-dev \
    libglib2.0-0 \
    libsm6 \
    libxrender1 \
    libxext6 \
    libgomp1 \
    libgl1 \
    && rm -rf /var/lib/apt/lists/*

# Install Python OCR dependencies.
# numpy MUST be in the same command so pip's resolver enforces <2.0 across all deps.
# paddlepaddle 2.6.2 is compiled against numpy 1.x ABI (0x1000009); numpy 2.x breaks it.
RUN pip3 install --no-cache-dir --break-system-packages \
    "numpy<2.0" \
    paddlepaddle==2.6.2 \
    paddleocr==2.7.3 \
    Pillow \
    requests \
    PyMuPDF

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

RUN npm run build

EXPOSE 3000
CMD ["npm", "run", "start:prod"]
