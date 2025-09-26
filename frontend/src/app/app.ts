import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-root',
  imports: [CommonModule],
  template: `
    <div class="app">
      <header class="header">
        <h1>Insurance OCR Application</h1>
        <p>Upload an image to extract text using OCR technology</p>
      </header>
      
      <main class="main-content">
        <div class="upload-section">
          <div class="file-input-wrapper">
            <input 
              type="file" 
              id="fileInput"
              (change)="onFileSelected($event)" 
              accept="image/*"
              class="file-input"
              [disabled]="isProcessing">
            <label for="fileInput" class="file-label" [class.disabled]="isProcessing">
              Choose Image
            </label>
          </div>
          
          <button 
            (click)="uploadImage()" 
            [disabled]="!selectedFile || isProcessing"
            class="upload-btn"
            [class.processing]="isProcessing">
            {{ isProcessing ? 'Processing...' : 'Process OCR' }}
          </button>

          <button 
            *ngIf="selectedFile || ocrResult || error"
            (click)="resetForm()" 
            class="reset-btn"
            [disabled]="isProcessing">
            Reset
          </button>
        </div>

        <!-- Error Display -->
        <div *ngIf="error" class="alert error-alert">
          <span class="alert-icon">!</span>
          <span class="alert-message">{{ error }}</span>
        </div>

        <!-- File Info -->
        <div *ngIf="selectedFile" class="alert info-alert">
          <span class="alert-icon">i</span>
          <span class="alert-message">
            <strong>Selected:</strong> {{ selectedFile.name }} 
            <small>({{ (selectedFile.size / 1024 / 1024).toFixed(2) }} MB)</small>
          </span>
        </div>

        <!-- Processing Indicator -->
        <div *ngIf="isProcessing" class="processing-indicator">
          <div class="spinner"></div>
          <span>Processing your image...</span>
        </div>

        <!-- Results -->
        <div *ngIf="ocrResult" class="results-section">
          <div class="results-header">
            <h2>OCR Results</h2>
            <div *ngIf="getConfidenceScore() > 0" class="confidence-badge">
              Confidence: {{ getConfidenceScore() }}%
            </div>
          </div>

          <!-- Extracted Text -->
          <div *ngIf="getExtractedText()" class="extracted-text">
            <h3>Extracted Text</h3>
            <div class="text-content">{{ getExtractedText() }}</div>
          </div>

          <!-- Detailed Results -->
          <div class="detailed-results">
            <h3>Detailed Results</h3>
            <div class="result-content">
              <pre>{{ ocrResult | json }}</pre>
            </div>
          </div>

          <!-- Individual Text Blocks -->
          <div *ngIf="ocrResult.text_blocks?.length" class="text-blocks">
            <h3>Individual Text Blocks</h3>
            <div class="blocks-container">
              <div *ngFor="let block of ocrResult.text_blocks; let i = index" class="text-block">
                <div class="block-header">
                  <span class="block-number">{{ i + 1 }}</span>
                  <span class="confidence">{{ (block.confidence * 100).toFixed(1) }}%</span>
                </div>
                <div class="block-text">{{ block.text }}</div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  `,
  styles: [`
    .app {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      color: #333;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
    }

    .header {
      background: rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(10px);
      text-align: center;
      padding: 40px 20px;
      box-shadow: 0 2px 20px rgba(0,0,0,0.1);
    }

    .header h1 {
      margin: 0 0 10px 0;
      font-size: 2.5rem;
      font-weight: 700;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    .header p {
      margin: 0;
      font-size: 1.1rem;
      color: #666;
    }

    .main-content {
      max-width: 900px;
      margin: 0 auto;
      padding: 40px 20px;
    }

    .upload-section {
      background: white;
      padding: 30px;
      border-radius: 15px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.1);
      margin-bottom: 30px;
      display: flex;
      gap: 15px;
      align-items: center;
      flex-wrap: wrap;
      justify-content: center;
    }

    .file-input-wrapper {
      position: relative;
    }

    .file-input {
      position: absolute;
      opacity: 0;
      width: 100%;
      height: 100%;
      cursor: pointer;
    }

    .file-input:disabled {
      cursor: not-allowed;
    }

    .file-label {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 15px 25px;
      background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
      border: 2px dashed #dee2e6;
      border-radius: 10px;
      cursor: pointer;
      transition: all 0.3s ease;
      font-weight: 500;
      font-size: 1rem;
    }

    .file-label:hover:not(.disabled) {
      background: linear-gradient(135deg, #e9ecef 0%, #dee2e6 100%);
      border-color: #adb5bd;
      transform: translateY(-2px);
    }

    .file-label.disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .upload-btn, .reset-btn {
      padding: 15px 25px;
      border: none;
      border-radius: 10px;
      cursor: pointer;
      font-size: 1rem;
      font-weight: 500;
      transition: all 0.3s ease;
    }

    .upload-btn {
      background: linear-gradient(135deg, #007bff 0%, #0056b3 100%);
      color: white;
    }

    .upload-btn:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 5px 15px rgba(0, 123, 255, 0.3);
    }

    .upload-btn:disabled {
      background: #6c757d;
      cursor: not-allowed;
      transform: none;
    }

    .upload-btn.processing {
      background: linear-gradient(135deg, #ffc107 0%, #e0a800 100%);
      color: #212529;
    }

    .reset-btn {
      background: linear-gradient(135deg, #6c757d 0%, #5a6268 100%);
      color: white;
    }

    .reset-btn:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 5px 15px rgba(108, 117, 125, 0.3);
    }

    .alert {
      padding: 15px 20px;
      border-radius: 10px;
      margin-bottom: 20px;
      display: flex;
      align-items: center;
      gap: 10px;
      backdrop-filter: blur(10px);
    }

    .error-alert {
      background: rgba(248, 215, 218, 0.95);
      border: 1px solid #f5c6cb;
      color: #721c24;
    }

    .info-alert {
      background: rgba(212, 237, 218, 0.95);
      border: 1px solid #c3e6cb;
      color: #155724;
    }

    .processing-indicator {
      display: flex;
      align-items: center;
      gap: 15px;
      padding: 20px;
      background: rgba(255, 243, 205, 0.95);
      border: 1px solid #ffeaa7;
      border-radius: 10px;
      margin-bottom: 20px;
      color: #856404;
      backdrop-filter: blur(10px);
    }

    .spinner {
      width: 20px;
      height: 20px;
      border: 2px solid #f3f3f3;
      border-top: 2px solid #007bff;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }

    .results-section {
      background: white;
      border-radius: 15px;
      padding: 30px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.1);
    }

    .results-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 30px;
      padding-bottom: 15px;
      border-bottom: 3px solid #007bff;
    }

    .results-header h2 {
      margin: 0;
      color: #333;
      font-size: 1.8rem;
    }

    .confidence-badge {
      background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
      color: white;
      padding: 8px 15px;
      border-radius: 20px;
      font-size: 0.9rem;
      font-weight: 500;
    }

    .extracted-text h3,
    .detailed-results h3,
    .text-blocks h3 {
      color: #495057;
      margin-bottom: 15px;
      font-size: 1.3rem;
    }

    .text-content {
      background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
      border: 1px solid #dee2e6;
      border-radius: 10px;
      padding: 20px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.8;
      white-space: pre-wrap;
      word-wrap: break-word;
      font-size: 1.1rem;
      margin-bottom: 30px;
    }

    .result-content {
      background: #f8f9fa;
      border: 1px solid #dee2e6;
      border-radius: 10px;
      padding: 20px;
      max-height: 400px;
      overflow-y: auto;
      margin-bottom: 30px;
    }

    .result-content pre {
      margin: 0;
      white-space: pre-wrap;
      word-wrap: break-word;
      font-family: 'Courier New', Courier, monospace;
      font-size: 0.9rem;
      line-height: 1.4;
    }

    .blocks-container {
      display: grid;
      gap: 15px;
      margin-top: 15px;
    }

    .text-block {
      background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%);
      border: 1px solid #dee2e6;
      border-radius: 10px;
      padding: 20px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.05);
      transition: transform 0.2s ease;
    }

    .text-block:hover {
      transform: translateY(-2px);
      box-shadow: 0 5px 20px rgba(0,0,0,0.1);
    }

    .block-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 15px;
    }

    .block-number {
      background: linear-gradient(135deg, #007bff 0%, #0056b3 100%);
      color: white;
      padding: 6px 12px;
      border-radius: 20px;
      font-size: 0.8rem;
      font-weight: bold;
    }

    .confidence {
      background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
      color: white;
      padding: 6px 12px;
      border-radius: 20px;
      font-size: 0.8rem;
      font-weight: 500;
    }

    .block-text {
      color: #495057;
      line-height: 1.6;
      font-weight: 500;
      font-size: 1.05rem;
    }

    @media (max-width: 768px) {
      .header h1 {
        font-size: 2rem;
      }
      
      .upload-section {
        flex-direction: column;
        align-items: stretch;
        text-align: center;
      }

      .results-header {
        flex-direction: column;
        gap: 15px;
        align-items: flex-start;
      }

      .main-content {
        padding: 20px 10px;
      }
    }
  `]
})
export class App {
  selectedFile: File | null = null;
  ocrResult: any = null;
  isProcessing = false;
  error = '';

  constructor(private http: HttpClient) {}

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      
      const validation = this.validateFile(file);
      if (validation) {
        this.error = validation;
        this.selectedFile = null;
        return;
      }

      this.selectedFile = file;
      this.error = '';
      this.ocrResult = null;
    }
  }

  validateFile(file: File): string | null {
    const maxSize = 10 * 1024 * 1024;
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];

    if (!allowedTypes.includes(file.type)) {
      return 'Please select a valid image file (JPEG, PNG, GIF)';
    }

    if (file.size > maxSize) {
      return 'File size must be less than 10MB';
    }

    return null;
  }

  uploadImage(): void {
    if (!this.selectedFile) return;

    this.isProcessing = true;
    this.error = '';

    const formData = new FormData();
    formData.append('image', this.selectedFile);

    this.http.post<any>('http://localhost:3000/api/upload-image', formData)
      .subscribe({
        next: (response) => {
          this.ocrResult = response.ocrResult;
          this.isProcessing = false;
        },
        error: (err) => {
          console.error('Upload error:', err);
          this.error = 'Failed to process image. Make sure the backend server is running on port 3000.';
          this.isProcessing = false;
        }
      });
  }

  resetForm(): void {
    this.selectedFile = null;
    this.ocrResult = null;
    this.error = '';
    this.isProcessing = false;
    
    const fileInput = document.getElementById('fileInput') as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }
  }

  getExtractedText(): string {
    return this.ocrResult?.full_text || '';
  }

  getConfidenceScore(): number {
    if (!this.ocrResult?.text_blocks?.length) return 0;
    
    const totalConfidence = this.ocrResult.text_blocks.reduce((sum: number, block: any) => 
      sum + block.confidence, 0);
    return Math.round((totalConfidence / this.ocrResult.text_blocks.length) * 100);
  }
}