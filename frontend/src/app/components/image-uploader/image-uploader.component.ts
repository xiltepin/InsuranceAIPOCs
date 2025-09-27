import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { OcrService } from '../../services/ocr.service';
import { OcrResponse } from '../../models/ocr-response.model';

@Component({
  selector: 'app-image-uploader',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './image-uploader.component.html',
  styleUrls: ['./image-uploader.component.scss'],
})
export class ImageUploaderComponent implements OnInit {
  selectedFile: File | null = null;
  ocrResult: OcrResponse | null = null;
  error: string | null = null;
  isProcessing = false;

  constructor(private ocrService: OcrService) {}

  ngOnInit(): void {}

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    console.log('File input changed:', input.files);
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      const validationError = this.validateFile(file);
      if (validationError) {
        this.error = validationError;
        this.selectedFile = null;
      } else {
        this.selectedFile = file;
        this.error = null;
        console.log('Selected file:', this.selectedFile);
      }
    } else {
      this.error = 'No file selected. Please try again.';
    }
  }

  validateFile(file: File): string | null {
    const maxSize = 10 * 1024 * 1024; // 10MB
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
  if (!this.selectedFile) {
    this.error = 'Please select an image first.';
    return;
  }
  this.isProcessing = true;
  this.error = null;
  console.log('Uploading file:', this.selectedFile);
  console.log('Request headers:', this.ocrService.uploadImage(this.selectedFile).request.headers);
  console.log('Request body:', this.ocrService.uploadImage(this.selectedFile).request.body);
  this.ocrService.uploadImage(this.selectedFile).subscribe({
    next: (response: OcrResponse) => {
      this.ocrResult = response;
      this.isProcessing = false;
      console.log('Upload success:', response);
    },
    error: (err) => {
      console.error('Upload error:', err);
      this.error = `Failed to process image. Status: ${err.status}. Message: ${err.message}. Check backend logs.`;
      this.isProcessing = false;
    },
  });
}

  resetForm(): void {
    this.selectedFile = null;
    this.ocrResult = null;
    this.error = null;
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
    const totalConfidence = this.ocrResult.text_blocks.reduce(
      (sum: number, block: any) => sum + block.confidence,
      0
    );
    return Math.round((totalConfidence / this.ocrResult.text_blocks.length) * 100);
  }
}