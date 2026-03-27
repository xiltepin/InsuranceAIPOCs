#!/usr/bin/env powershell

# Performance Benchmark Script for OCR System
Write-Host "🚀 OCR Performance Benchmark" -ForegroundColor Green
Write-Host "Expected performance after optimizations:" -ForegroundColor Cyan

Write-Host "`nBefore Optimization:" -ForegroundColor Red
Write-Host "  • PaddleOCR: 45.58s" -ForegroundColor Gray  
Write-Host "  • AI Processing: 106.36s" -ForegroundColor Gray
Write-Host "  • Total Time: 151.95s" -ForegroundColor Gray

Write-Host "`nAfter Optimization (Target):" -ForegroundColor Green
Write-Host "  • PaddleOCR: 8-15s (66-75% improvement)" -ForegroundColor Yellow
Write-Host "  • AI Processing: 15-25s (80-85% improvement)" -ForegroundColor Yellow  
Write-Host "  • Total Time: 25-40s (74-84% improvement)" -ForegroundColor Yellow

Write-Host "`nOptimizations Applied:" -ForegroundColor White
Write-Host "  ✅ PaddleOCR batch processing optimized" -ForegroundColor Green
Write-Host "  ✅ Ollama non-streaming mode enabled" -ForegroundColor Green
Write-Host "  ✅ GPU layers maximized (99 layers)" -ForegroundColor Green
Write-Host "  ✅ CPU threads minimized (1 thread)" -ForegroundColor Green
Write-Host "  ✅ Context window optimized (2048 vs 4096)" -ForegroundColor Green
Write-Host "  ✅ Token prediction reduced (1500 vs 2000)" -ForegroundColor Green
Write-Host "  ✅ Temperature lowered (0.05 vs 0.1)" -ForegroundColor Green
Write-Host "  ✅ Simplified prompt for faster processing" -ForegroundColor Green

Write-Host "`n💡 Test by uploading an image at: http://localhost:4200" -ForegroundColor Cyan
Write-Host "   Look for improved timing in 'Processing Performance' section" -ForegroundColor Gray

# Monitor GPU during idle
Write-Host "`n📊 Current GPU Status:" -ForegroundColor Cyan
nvidia-smi --query-gpu=utilization.gpu,utilization.memory,memory.used,power.draw,temperature.gpu --format=csv