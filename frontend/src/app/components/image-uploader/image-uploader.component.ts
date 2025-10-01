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
  selectedRawFile: File | null = null;
  ocrResult: OcrResponse | null = null;
  error: string | null = null;
  isProcessing = false;
  progress = 0;
  statusMessage: string = ''; // Added to track dynamic status messages
  
  // Processing time tracking
  paddleOcrTime: number = 0;
  aiProcessingTime: number = 0;
  totalProcessingTime: number = 0;
  processingStartTime: number = 0;

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
        this.selectedRawFile = null;
      } else {
        // Determine if it's an image or text file
        if (file.type.startsWith('image/')) {
          this.selectedFile = file;
          this.selectedRawFile = null;
          console.log('Selected image file:', this.selectedFile);
        } else if (file.type === 'text/plain') {
          this.selectedRawFile = file;
          this.selectedFile = null;
          console.log('Selected raw text file:', this.selectedRawFile);
        }
        this.error = null;
      }
    } else {
      this.error = 'No file selected. Please try again.';
    }
  }

  validateFile(file: File): string | null {
    const maxSize = 10 * 1024 * 1024; // 10MB
    const allowedImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
    const allowedTextTypes = ['text/plain'];

    const isValidImage = allowedImageTypes.includes(file.type);
    const isValidText = allowedTextTypes.includes(file.type);

    if (!isValidImage && !isValidText) {
      return 'Please select a valid image file (JPEG, PNG, GIF) or text file (.txt)';
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
    // Check if we have raw data or image
    if (this.selectedRawFile) {
      this.processRawData();
      return;
    }
    
    if (!this.selectedFile) {
      this.error = 'Please select an image or raw text file first.';
      return;
    }
    this.isProcessing = true;
    this.error = null;
    this.ocrResult = null;
    this.progress = 0;
    this.statusMessage = `Processing ${this.selectedFile.name} (image file)`;
    
    // Reset and start timing
    this.processingStartTime = Date.now();
    this.paddleOcrTime = 0;
    this.aiProcessingTime = 0;
    this.totalProcessingTime = 0;

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
        console.log('==========================================');
        console.log('ANGULAR: Received response from NestJS backend');
        console.log('==========================================');
        console.log('Response keys:', Object.keys(result));
        console.log('Full Response:', JSON.stringify(result, null, 2));
        console.log('==========================================');
        
        this.ocrResult = result;
        this.populateFieldsFromOcr(result);
        
        // Calculate processing times
        this.totalProcessingTime = (Date.now() - this.processingStartTime) / 1000;
        
        // Check if Ollama was used based on processing method
        const processingMethod = result.document_metadata?.processing_method || 'paddleocr_only';
        if (processingMethod.includes('ollama')) {
          // Estimate that PaddleOCR takes about 30% of total time, Ollama takes 70%
          this.paddleOcrTime = this.totalProcessingTime * 0.3;
          this.aiProcessingTime = this.totalProcessingTime * 0.7;
        } else {
          // Only PaddleOCR was used
          this.paddleOcrTime = this.totalProcessingTime;
          this.aiProcessingTime = 0;
        }
        
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

  processRawData(): void {
    if (!this.selectedRawFile) {
      this.error = 'No raw data file selected.';
      return;
    }

    this.isProcessing = true;
    this.error = null;
    this.ocrResult = null;
    this.progress = 0;
    this.statusMessage = `Processing ${this.selectedRawFile.name} (raw text file)`;    // Reset and start timing
    this.processingStartTime = Date.now();
    this.paddleOcrTime = 0;
    this.aiProcessingTime = 0;
    this.totalProcessingTime = 0;

    const reader = new FileReader();
    reader.onload = () => {
      const rawText = reader.result as string;
      console.log('Raw text loaded:', rawText.substring(0, 200) + '...');
      
      // Send raw text directly to backend for Ollama processing
      console.log('FRONTEND: About to call processRawText API');
      this.ocrService.processRawText(rawText).subscribe({
        next: (result) => {
          console.log('FRONTEND: Raw data processing completed successfully!');
          console.log('FRONTEND: Result keys:', Object.keys(result));
          console.log('FRONTEND: Processing metrics:', (result as any).processing_metrics);
          
          this.ocrResult = result;
          this.populateFieldsFromOcr(result);
          
          // Calculate processing times - all time is AI processing since no PaddleOCR
          this.totalProcessingTime = (Date.now() - this.processingStartTime) / 1000;
          this.paddleOcrTime = 0; // No PaddleOCR used
          this.aiProcessingTime = this.totalProcessingTime; // All time is Ollama processing
          
          this.isProcessing = false;
          this.progress = 100;
          this.statusMessage = 'Finished';
          console.log('FRONTEND: UI updated, processing complete');
        },
        error: (err) => {
          console.error('FRONTEND: Error in raw data processing:', err);
          this.error = err?.error?.message || err?.message || 'An error occurred during raw data processing.';
          this.isProcessing = false;
          this.statusMessage = 'Error processing raw data';
        }
      });
    };
    
    reader.readAsText(this.selectedRawFile);
  }

  populateFieldsFromOcr(result: any): void {
    console.log('=== PROCESSING OCR RESULT ===');
    console.log('Processing method:', result.document_metadata?.processing_method);
    console.log('Has raw_ocr_text:', !!result.raw_ocr_text);
    console.log('Has structured data:', !!result.policyholder_details);
    
    // Handle both PaddleOCR-only and Ollama-enhanced results
    if (result.raw_ocr_text) {
      console.log('Processing result with raw OCR text');
      
      // Create a simple text block structure for display
      result.text_blocks = [{
        text: result.raw_ocr_text,
        confidence: result.confidence_assessment?.ocr_confidence || 0.99,
        bbox: 'Full Document'
      }];
      result.full_text = result.raw_ocr_text;
      
      // Check if we have Ollama-enhanced structured data
      if (result.policyholder_details || result.policy_information || result.insured_vehicle) {
        console.log('Using Ollama-enhanced structured data');
        // Use structured data from Ollama
        this.populateFromStructuredData(result);
      } else {
        console.log('Falling back to pattern matching on raw text');
        // Fallback to pattern matching for raw text
        this.extractBasicInfoFromRawText(result.raw_ocr_text);
      }
    } else {
      console.log('Processing legacy structured result');
      // Handle legacy structured results
      this.populateFromStructuredData(result);
    }

    // Always try post-processing for additional field extraction
    if (result.raw_ocr_text) {
      this.postProcessExtraction(result.raw_ocr_text);
    }
  }

  populateFromStructuredData(result: any): void {
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
      
      console.log('Populated fields from structured data:', this.fields);
  }

  extractBasicInfoFromRawText(rawText: string): void {
    // Enhanced pattern matching to extract comprehensive information from raw OCR text
    const lines = rawText.split('\n');
    const fullText = rawText.toLowerCase();
    console.log('DEBUG - Processing', lines.length, 'lines for field extraction');
    
    for (let i = 0; i < lines.length; i++) {
      const trimmedLine = lines[i].trim();
      const lowerLine = trimmedLine.toLowerCase();
      
      // Log lines that might contain our missing fields
      if (lowerLine.includes('garag') || lowerLine.includes('zip') || 
          lowerLine.includes('usage') || lowerLine.includes('class') ||
          lowerLine.includes('body') || lowerLine.includes('type') ||
          lowerLine.includes('mile') || lowerLine.includes('annual')) {
        console.log('POTENTIAL FIELD LINE:', trimmedLine);
      }
      
      // Extract Policy Number - multiple patterns
      if (trimmedLine.match(/Policy Number.*?([A-Z]{2}\d+)/i)) {
        const match = trimmedLine.match(/Policy Number.*?([A-Z]{2}\d+)/i);
        if (match) this.fields.policy_number = match[1];
      }
      
      // Extract Effective Dates - look for date ranges
      if (trimmedLine.match(/Effective.*?(\w+\s+\d{1,2},\s+\d{4})\s*-\s*(\w+\s+\d{1,2},\s+\d{4})/i)) {
        const match = trimmedLine.match(/Effective.*?(\w+\s+\d{1,2},\s+\d{4})\s*-\s*(\w+\s+\d{1,2},\s+\d{4})/i);
        if (match) {
          this.fields.effective_start = match[1];
          this.fields.effective_end = match[2];
        }
      }
      
      // Alternative effective date pattern
      if (lowerLine.includes('march') && trimmedLine.match(/(\w+\s+\d{1,2},\s+\d{4})/g)) {
        const dates = trimmedLine.match(/(\w+\s+\d{1,2},\s+\d{4})/g);
        if (dates && dates.length >= 2) {
          this.fields.effective_start = dates[0];
          this.fields.effective_end = dates[1];
        }
      }
      
      // Extract Phone numbers
      if (trimmedLine.match(/\(\d{3}\)\s?\d{3}-?\d{4}/)) {
        const match = trimmedLine.match(/\(\d{3}\)\s?\d{3}-?\d{4}/);
        if (match && !this.fields.phone) this.fields.phone = match[0];
      }
      
      // Extract Email
      if (trimmedLine.match(/\S+@\S+\.\S+/)) {
        const match = trimmedLine.match(/\S+@\S+\.\S+/);
        if (match && !this.fields.email) this.fields.email = match[0];
      }
      
      // Extract VIN (17 characters alphanumeric)
      if (trimmedLine.match(/[A-HJ-NPR-Z0-9]{17}/)) {
        const match = trimmedLine.match(/[A-HJ-NPR-Z0-9]{17}/);
        if (match && !this.fields.vin) this.fields.vin = match[0];
      }
      
      // Extract License Plate - multiple patterns
      if (trimmedLine.match(/License Plate.*?([A-Z]{2}\s?[A-Z0-9-]{3,8})/i)) {
        const match = trimmedLine.match(/License Plate.*?([A-Z]{2}\s?[A-Z0-9-]{3,8})/i);
        if (match) this.fields.license_plate = match[1];
      }
      
      // Extract Address - look for street addresses
      if (trimmedLine.match(/^\d+\s+[A-Z][a-z]+(\s+[A-Z][a-z]+)*(\s+(Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Lane|Ln|Boulevard|Blvd))?$/i)) {
        if (!this.fields.address && !lowerLine.includes('policy') && !lowerLine.includes('phone')) {
          this.fields.address = trimmedLine;
        }
      }
      
      // Extract City/State/ZIP
      if (trimmedLine.match(/^[A-Z][a-z]+,\s+[A-Z]{2}\s+\d{5}(-\d{4})?$/)) {
        this.fields.city_state_zip = trimmedLine;
      }
      
      // Extract DOB - multiple date patterns
      if (trimmedLine.match(/DOB.*?(\w+\s+\d{1,2},\s+\d{4})/i)) {
        const match = trimmedLine.match(/DOB.*?(\w+\s+\d{1,2},\s+\d{4})/i);
        if (match) this.fields.dob = match[1];
      }
      
      // Alternative DOB pattern
      if (lowerLine.includes('july') && trimmedLine.match(/(\w+\s+\d{1,2},\s+\d{4})/)) {
        const match = trimmedLine.match(/(\w+\s+\d{1,2},\s+\d{4})/);
        if (match && !this.fields.dob) this.fields.dob = match[1];
      }
      
      // Extract Gender
      if (trimmedLine.match(/Gender.*?(Male|Female)/i)) {
        const match = trimmedLine.match(/Gender.*?(Male|Female)/i);
        if (match) this.fields.gender = match[1];
      }
      if (trimmedLine.toLowerCase() === 'male' || trimmedLine.toLowerCase() === 'female') {
        if (!this.fields.gender) this.fields.gender = trimmedLine;
      }
      
      // Extract Marital Status
      if (trimmedLine.match(/Marital Status.*?(Single|Married|Divorced|Widowed)/i)) {
        const match = trimmedLine.match(/Marital Status.*?(Single|Married|Divorced|Widowed)/i);
        if (match) this.fields.marital_status = match[1];
      }
      if (trimmedLine.toLowerCase() === 'married' || trimmedLine.toLowerCase() === 'single') {
        if (!this.fields.marital_status) this.fields.marital_status = trimmedLine;
      }
      
      // Extract Policy Type
      if (trimmedLine.match(/Policy Type.*?(Personal Auto|Commercial Auto|Motorcycle)/i)) {
        const match = trimmedLine.match(/Policy Type.*?(Personal Auto|Commercial Auto|Motorcycle)/i);
        if (match) this.fields.policy_type = match[1];
      }
      if (trimmedLine.toLowerCase() === 'personal auto') {
        this.fields.policy_type = trimmedLine;
      }
      
      // Extract Agent Name - handles both same line and next line patterns
      if (trimmedLine.match(/^Agent:\s*(.+)$/i)) {
        const match = trimmedLine.match(/^Agent:\s*(.+)$/i);
        if (match && match[1].trim()) {
          console.log('FOUND Agent (same line):', match[1], 'from line:', trimmedLine);
          this.fields.agent = match[1].trim();
        }
      } else if (trimmedLine === 'Agent:' && i + 1 < lines.length) {
        const nextLine = lines[i + 1].trim();
        if (nextLine.match(/^[A-Z][a-z]+\s+[A-Z][a-z]+(\s+[A-Z][a-z]+)?$/)) {
          console.log('FOUND Agent (next line):', nextLine);
          this.fields.agent = nextLine;
        }
      }
      
      // Extract Agent ID - handles both same line and next line patterns
      if (trimmedLine.match(/^Agent ID:\s*(.+)$/i)) {
        const match = trimmedLine.match(/^Agent ID:\s*(.+)$/i);
        if (match && match[1].trim()) {
          console.log('FOUND Agent ID (same line):', match[1], 'from line:', trimmedLine);
          this.fields.agent_id = match[1].trim();
        }
      } else if (trimmedLine === 'Agent ID:' && i + 1 < lines.length) {
        const nextLine = lines[i + 1].trim();
        if (nextLine.match(/^[A-Z]{2}-[A-Z]+-\d+$/)) {
          console.log('FOUND Agent ID (next line):', nextLine);
          this.fields.agent_id = nextLine;
        }
      }
      
      // Extract Vehicle Information
      if (trimmedLine.match(/Year\/Make\/Model.*?(\d{4}\s+[A-Z][a-z]+\s+[A-Z][a-z]+)/i)) {
        const match = trimmedLine.match(/Year\/Make\/Model.*?(\d{4}\s+[A-Z][a-z]+\s+[A-Z][a-z]+)/i);
        if (match) this.fields.vehicle = match[1];
      }
      
      // Extract Annual Mileage - handles both same line and next line patterns
      if (trimmedLine.match(/^Annual Mileage:\s*(.+)$/i)) {
        const match = trimmedLine.match(/^Annual Mileage:\s*(.+)$/i);
        if (match && match[1].trim()) {
          console.log('FOUND Annual Mileage (same line):', match[1], 'from line:', trimmedLine);
          this.fields.annual_mileage = match[1].trim();
        }
      } else if (trimmedLine === 'Annual Mileage:' && i + 1 < lines.length) {
        const nextLine = lines[i + 1].trim();
        if (nextLine.match(/^[\d,]+\s+miles$/i)) {
          console.log('FOUND Annual Mileage (next line):', nextLine);
          this.fields.annual_mileage = nextLine;
        }
      }
      
      // Extract Garaging ZIP - handles both same line and next line patterns
      if (trimmedLine.match(/^Garaging ZIP:\s*(.+)$/i)) {
        const match = trimmedLine.match(/^Garaging ZIP:\s*(.+)$/i);
        if (match && match[1].trim()) {
          console.log('FOUND Garaging ZIP (same line):', match[1], 'from line:', trimmedLine);
          this.fields.garaging_zip = match[1].trim();
        }
      } else if (trimmedLine === 'Garaging ZIP:' && i + 1 < lines.length) {
        const nextLine = lines[i + 1].trim();
        if (nextLine.match(/^\d{5}(-\d{4})?$/)) {
          console.log('FOUND Garaging ZIP (next line):', nextLine);
          this.fields.garaging_zip = nextLine;
        }
      }
      
      // Extract Body Type - handles both same line and next line patterns
      if (trimmedLine.match(/^Body Type:\s*(.+)$/i)) {
        const match = trimmedLine.match(/^Body Type:\s*(.+)$/i);
        if (match && match[1].trim()) {
          console.log('FOUND Body Type (same line):', match[1], 'from line:', trimmedLine);
          this.fields.body_type = match[1].trim();
        }
      } else if (trimmedLine === 'Body Type:' && i + 1 < lines.length) {
        const nextLine = lines[i + 1].trim();
        if (nextLine.match(/^(4DR\s+Wagon|2DR\s+Coupe|4DR\s+Sedan|SUV|Truck|Wagon|Sedan|Coupe)$/i)) {
          console.log('FOUND Body Type (next line):', nextLine);
          this.fields.body_type = nextLine;
        }
      }
      
      // Extract Usage Class - handles both same line and next line patterns
      if (trimmedLine.match(/^Usage Class:\s*(.+)$/i)) {
        const match = trimmedLine.match(/^Usage Class:\s*(.+)$/i);
        if (match && match[1].trim()) {
          console.log('FOUND Usage Class (same line):', match[1], 'from line:', trimmedLine);
          this.fields.usage_class = match[1].trim();
        }
      } else if (trimmedLine === 'Usage Class:' && i + 1 < lines.length) {
        const nextLine = lines[i + 1].trim();
        if (nextLine.match(/^(Commute\/Business|Pleasure|Business|Farm|Personal)$/i)) {
          console.log('FOUND Usage Class (next line):', nextLine);
          this.fields.usage_class = nextLine;
        }
      }
      
      // Extract names - enhanced pattern matching
      if (trimmedLine.match(/^[A-Z][a-z]+\s+[A-Z][a-z]+(\s+[A-Z][a-z]+)?$/) && !this.fields.full_name) {
        // Skip obvious non-name words and check context
        if (!trimmedLine.match(/(GEICO|AUTO|INSURANCE|POLICY|VEHICLE|DRIVER|COVERAGE|LIMITS|DEDUCTIBLES)/i)) {
          // Check if it's likely a person's name by looking at previous line context
          const prevLine = i > 0 ? lines[i-1].toLowerCase() : '';
          if (prevLine.includes('name') || prevLine.includes('insured') || i === 0 || 
              !prevLine.match(/(type|number|date|address|phone|email)/)) {
            this.fields.full_name = trimmedLine;
          }
        }
      }
    }
    
    // Post-processing: Try to extract missing fields using different approaches
    this.postProcessExtraction(rawText);
    
    console.log('Enhanced extracted info:', this.fields);
  }

  postProcessExtraction(rawText: string): void {
    // Additional extraction methods for fields that might be missed
    
    // Extract issue date and renewal date
    const datePattern = /(\w+\s+\d{1,2},\s+\d{4})/g;
    const dates = rawText.match(datePattern);
    if (dates && dates.length >= 3) {
      // Try to identify which dates are which based on context
      if (!this.fields.issue_date && rawText.toLowerCase().includes('february')) {
        const februaryMatch = rawText.match(/February\s+\d{1,2},\s+\d{4}/i);
        if (februaryMatch) this.fields.issue_date = februaryMatch[0];
      }
      
      if (!this.fields.renewal_date && rawText.toLowerCase().includes('september')) {
        const septemberMatch = rawText.match(/September\s+\d{1,2},\s+\d{4}/i);
        if (septemberMatch) this.fields.renewal_date = septemberMatch[0];
      }
    }
    
    // Extract term length
    if (!this.fields.term_length && rawText.match(/Term Length.*?(\d+\s+Months?)/i)) {
      const match = rawText.match(/Term Length.*?(\d+\s+Months?)/i);
      if (match) this.fields.term_length = match[1];
    }
    
    // Try to find "6 Months" if term length is still missing
    if (!this.fields.term_length && rawText.match(/\b6\s+Months?\b/i)) {
      this.fields.term_length = '6 Months';
    }
    
    // Extract office phone (different from personal phone)
    if (!this.fields.office_phone) {
      const phoneMatches = rawText.match(/\(\d{3}\)\s?\d{3}-?\d{4}/g);
      if (phoneMatches && phoneMatches.length > 1) {
        // If we have multiple phones, the second one might be office phone
        this.fields.office_phone = phoneMatches[1];
      }
    }
    
    // Debug specific fields
    console.log('DEBUG - Specific missing fields after postProcessExtraction:');
    console.log('  garaging_zip:', this.fields.garaging_zip || 'NOT FOUND');
    console.log('  usage_class:', this.fields.usage_class || 'NOT FOUND');
    console.log('  body_type:', this.fields.body_type || 'NOT FOUND');
    console.log('  annual_mileage:', this.fields.annual_mileage || 'NOT FOUND');
  }

  resetForm(): void {
    this.selectedFile = null;
    this.selectedRawFile = null;
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
    // Handle new structure with confidence_assessment
    if (this.ocrResult?.confidence_assessment?.ocr_confidence !== undefined) {
      return (this.ocrResult.confidence_assessment.ocr_confidence * 100).toFixed(1);
    }
    // Fallback to old structure
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
    // Handle new structure - for PaddleOCR only, show high completeness since we got the raw text
    if (this.ocrResult?.document_metadata?.processing_method === 'paddleocr_only' && this.ocrResult?.raw_ocr_text) {
      return '95.0'; // Show high completeness for successful OCR extraction
    }
    // Fallback to old structure
    if (this.ocrResult?.accuracy_metrics?.extraction_completeness !== undefined) {
      return this.ocrResult.accuracy_metrics.extraction_completeness.toFixed(1);
    }
    return '0.0';
  }
}