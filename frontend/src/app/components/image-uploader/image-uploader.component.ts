import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OcrService } from '../../services/ocr.service';
import { OcrResponse } from '../../models/ocr-response.model';

@Component({
  selector: 'app-image-uploader',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './image-uploader.component.html',
  styleUrls: ['./image-uploader.component.scss'],
})
export class ImageUploaderComponent implements OnInit {
  selectedFile: File | null = null;
  ocrResult: OcrResponse | null = null;
  error: string | null = null;
  isProcessing = false;
  progress = 0;
  statusMessage: string = ''; // Added to track dynamic status messages

  fields: any = {
    policy_number: '',
    effective_start: '',
    effective_end: '',
    full_name: '',
    address: '',
    city_state_zip: '',
    phone: '',
    email: '',
    dob: '',
    gender: '',
    marital_status: '',
    policy_type: '',
    issue_date: '',
    term_length: '',
    renewal_date: '',
    agent: '',
    agent_id: '',
    office_phone: '',
    vehicle: '',
    vin: '',
    license_plate: '',
    body_type: '',
    usage_class: '',
    annual_mileage: '',
    garaging_zip: ''
  };

  constructor(private ocrService: OcrService, private cdr: ChangeDetectorRef) {}

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

  onJsonSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const json = JSON.parse(reader.result as string);
          this.ocrResult = json;
          this.populateFieldsFromOcr(json);
          this.error = null;
        } catch (e) {
          this.error = 'Invalid JSON file.';
        }
      };
      reader.readAsText(file);
    }
  }

  uploadImage(): void {
    if (!this.selectedFile) {
      this.error = 'Please select an image first.';
      return;
    }
    this.isProcessing = true;
    this.error = null;
    this.ocrResult = null;
    this.progress = 0;
    this.statusMessage = '1 file sent';

    const steps = [
      'OCR processing...',
      'OCR Provided Raw data',
      'Raw data sent to AI',
      'Waiting for AI output'
    ];

    let currentStep = 0;
    const progressInterval = setInterval(() => {
      if (currentStep < steps.length - 1 && this.isProcessing) {
        this.progress = Math.round(((currentStep + 1) / steps.length) * 100);
        currentStep++;
        this.statusMessage = steps[currentStep];
      }
    }, 1000);

    this.ocrService.uploadImage(this.selectedFile).subscribe({
      next: (result) => {
        this.ocrResult = result;
        this.populateFieldsFromOcr(result);
        this.isProcessing = false;
        this.progress = 100;
        this.statusMessage = 'Finished';
        clearInterval(progressInterval);
      },
      error: (err) => {
        this.error = err?.error?.message || err?.message || 'An error occurred during OCR processing.';
        this.isProcessing = false;
        this.statusMessage = 'Waiting for AI output';
        clearInterval(progressInterval);
      }
    });
  }

  populateFieldsFromOcr(result: any): void {
    this.fields.policy_number = result.policy_number || '';
    this.fields.effective_start = result.effective_dates?.start || '';
    this.fields.effective_end = result.effective_dates?.end || '';
    this.fields.full_name = result.policyholder_details?.full_name || '';
    this.fields.address = result.policyholder_details?.address || '';
    this.fields.city_state_zip = result.policyholder_details?.city_state_zip || '';
    this.fields.phone = result.policyholder_details?.phone || '';
    this.fields.email = result.policyholder_details?.email || '';
    this.fields.dob = result.policyholder_details?.dob || '';
    this.fields.gender = result.policyholder_details?.gender || '';
    this.fields.marital_status = result.policyholder_details?.marital_status || '';
    this.fields.policy_type = result.policy_information?.policy_type || '';
    this.fields.issue_date = result.policy_information?.issue_date || '';
    this.fields.term_length = result.policy_information?.term_length || '';
    this.fields.renewal_date = result.policy_information?.renewal_date || '';
    this.fields.agent = result.policy_information?.agent || '';
    this.fields.agent_id = result.policy_information?.agent_id || '';
    this.fields.office_phone = result.policy_information?.office_phone || '';
    const year = result.insured_vehicle?.year || '';
    const make = result.insured_vehicle?.make || '';
    const model = result.insured_vehicle?.model || '';
    this.fields.vehicle = [year, make, model].filter(Boolean).join(' ');
    this.fields.vin = result.insured_vehicle?.vin || '';
    this.fields.license_plate = result.insured_vehicle?.license_plate || '';
    this.fields.body_type = result.insured_vehicle?.body_type || '';
    this.fields.usage_class = result.insured_vehicle?.usage_class || '';
    this.fields.annual_mileage = result.insured_vehicle?.mileage || '';
    this.fields.garaging_zip = result.insured_vehicle?.garage_zip || '';

    // Update status to 'Finished' after populating fields
    this.statusMessage = 'Finished';
    this.isProcessing = false;

    // Trigger Angular change detection
    this.cdr.detectChanges();
  }

  resetForm(): void {
    this.selectedFile = null;
    this.ocrResult = null;
    this.error = null;
    this.isProcessing = false;
    this.fields = {
      policy_number: '',
      effective_start: '',
      effective_end: '',
      full_name: '',
      address: '',
      city_state_zip: '',
      phone: '',
      email: '',
      dob: '',
      gender: '',
      marital_status: '',
      policy_type: '',
      issue_date: '',
      term_length: '',
      renewal_date: '',
      agent: '',
      agent_id: '',
      office_phone: '',
      vehicle: '',
      vin: '',
      license_plate: '',
      body_type: '',
      usage_class: '',
      annual_mileage: '',
      garaging_zip: ''
    };
    const fileInput = document.getElementById('fileInput') as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }
  }

  getExtractedText(): string {
    if (this.ocrResult?.full_text) {
      return this.ocrResult.full_text;
    }
    if (this.ocrResult?.text_blocks) {
      return this.ocrResult.text_blocks.map(b => b.text).join(' ');
    }
    return '';
  }

  getConfidenceScore(): string {
    if (this.ocrResult?.accuracy_metrics?.ocr_confidence !== undefined) {
      return (this.ocrResult.accuracy_metrics.ocr_confidence * 100).toFixed(1);
    }
    if (this.ocrResult?.text_blocks && this.ocrResult.text_blocks.length > 0) {
      const avg = this.ocrResult.text_blocks.reduce((sum, b) => sum + b.confidence, 0) / this.ocrResult.text_blocks.length;
      return (avg * 100).toFixed(1);
    }
    return '0.0';
  }

  getExtractionCompleteness(): string {
    if (this.ocrResult?.accuracy_metrics?.extraction_completeness !== undefined) {
      return this.ocrResult.accuracy_metrics.extraction_completeness.toFixed(1);
    }
    return '0.0';
  }
}