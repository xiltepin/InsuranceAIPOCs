#!/usr/bin/env powershell

# GPU Performance Warm-up Script
Write-Host "Warming up Tesla P100 GPU for optimal performance..." -ForegroundColor Green

# Check current GPU status
Write-Host "Current GPU Status:" -ForegroundColor Cyan
nvidia-smi --query-gpu=name,utilization.gpu,memory.used,memory.total,power.draw,temperature.gpu --format=csv

# Warm up Ollama with a quick inference
Write-Host "Warming up Ollama model..." -ForegroundColor Yellow
$warmupPrompt = 'Quick test: What is 2+2? Answer in JSON format'
ollama run llama3.2:3b $warmupPrompt

Write-Host "GPU warm-up complete!" -ForegroundColor Green
Write-Host "Expected performance after warm-up:" -ForegroundColor White
Write-Host "  • PaddleOCR: 8-15 seconds" -ForegroundColor Gray
Write-Host "  • AI Processing: 15-30 seconds" -ForegroundColor Gray
Write-Host "  • Total Time: 25-45 seconds" -ForegroundColor Gray

# Final GPU status check
Write-Host "GPU Status After Warm-up:" -ForegroundColor Cyan
nvidia-smi --query-gpu=utilization.gpu,memory.used,power.draw --format=csv,noheader,nounits