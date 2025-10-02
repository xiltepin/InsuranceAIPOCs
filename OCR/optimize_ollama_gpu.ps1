#!/usr/bin/env powershell

# Kill existing Ollama processes
Write-Host "Stopping existing Ollama processes..."
Get-Process -Name "ollama*" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

# Set GPU optimization environment variables
$env:OLLAMA_NUM_PARALLEL = "1"          # Process one request at a time for max GPU usage
$env:OLLAMA_MAX_LOADED_MODELS = "1"     # Keep only one model loaded
$env:OLLAMA_FLASH_ATTENTION = "1"       # Enable flash attention for GPU efficiency
$env:OLLAMA_KV_CACHE_TYPE = "f16"       # Use fp16 for better GPU memory usage
$env:OLLAMA_NUM_GPU = "1"               # Force GPU usage
$env:OLLAMA_GPU_OVERHEAD = "0"          # Minimize GPU overhead
$env:CUDA_VISIBLE_DEVICES = "0"         # Use Tesla P100 (device 0)

Write-Host "Starting Ollama with GPU-optimized settings..."
Write-Host "Environment variables set:"
Write-Host "  OLLAMA_NUM_PARALLEL = $env:OLLAMA_NUM_PARALLEL"
Write-Host "  OLLAMA_MAX_LOADED_MODELS = $env:OLLAMA_MAX_LOADED_MODELS"
Write-Host "  OLLAMA_FLASH_ATTENTION = $env:OLLAMA_FLASH_ATTENTION"
Write-Host "  OLLAMA_KV_CACHE_TYPE = $env:OLLAMA_KV_CACHE_TYPE"
Write-Host "  CUDA_VISIBLE_DEVICES = $env:CUDA_VISIBLE_DEVICES"

# Start Ollama service
Start-Process -FilePath "ollama" -ArgumentList "serve" -NoNewWindow

Write-Host "Waiting for Ollama to start..."
Start-Sleep -Seconds 5

Write-Host "Preloading llama3.2:3b model to GPU..."
ollama run llama3.2:3b "Ready for GPU processing"

Write-Host "Ollama GPU optimization complete!"
Write-Host "Check GPU usage with: nvidia-smi"