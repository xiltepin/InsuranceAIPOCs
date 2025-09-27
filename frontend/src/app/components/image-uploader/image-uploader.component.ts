import { Component, OnInit } from '@angular/core';
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
    this.ocrResult = null;
    this.ocrService.uploadImage(this.selectedFile).subscribe({
      next: (result) => {
        this.ocrResult = result;
        this.populateFieldsFromOcr(result);
        this.isProcessing = false;
      },
      error: (err) => {
        this.error = err?.error?.message || err?.message || 'An error occurred during OCR processing.';
        this.isProcessing = false;
      }
    });
  }

  populateFieldsFromOcr(result: any) {
    // Defensive: check for all nested fields
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
    this.fields.vehicle = result.insured_vehicle?.['year/make/model'] || '';
    this.fields.vin = result.insured_vehicle?.['VIN Number'] || '';
    this.fields.license_plate = result.insured_vehicle?.license_plate || '';
    this.fields.body_type = result.insured_vehicle?.body_type || '';
    this.fields.usage_class = result.insured_vehicle?.usage_class || '';
    this.fields.annual_mileage = result.insured_vehicle?.annual_mileage || '';
    this.fields.garaging_zip = result.insured_vehicle?.garaging_zip || '';
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
    if (this.ocrResult?.text_blocks && this.ocrResult.text_blocks.length > 0) {
      const avg = this.ocrResult.text_blocks.reduce((sum, b) => sum + b.confidence, 0) / this.ocrResult.text_blocks.length;
      return avg.toFixed(2);
    }
    return '0.00';
  }
}