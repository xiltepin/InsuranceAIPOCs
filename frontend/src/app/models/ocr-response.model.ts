export interface TextBlock {
  text: string;
  confidence: number;
  bbox: number[];
}

export interface OcrResponse {
  status?: string;
  image_path?: string;
  text_blocks?: TextBlock[];
  full_text?: string;
  message?: string;
  error?: string;
  accuracy_metrics?: {
    ocr_confidence: number;
    extraction_completeness: number;
  };
  progress?: number; // 0-100, for streaming/progress
  
  // New fields for PaddleOCR-only structure
  document_metadata?: {
    filename: string;
    extraction_timestamp: string;
    document_language: string;
    document_type: string;
    processing_method: string;
  };
  raw_ocr_text?: string;
  confidence_assessment?: {
    overall_confidence: string;
    ocr_confidence: number;
    extraction_method: string;
  };
  
  // Structured fields (may be empty when Ollama is disabled)
  policy_number?: string;
  effective_dates?: {
    start: string;
    end: string;
  };
  policyholder_details?: {
    full_name: string;
    address: string;
    city_state_zip: string;
    phone: string;
    email: string;
    dob: string;
    gender: string;
    marital_status: string;
  };
  policy_information?: {
    policy_type: string;
    issue_date: string;
    term_length: string;
    renewal_date: string;
    agent: string;
    agent_id: string;
    office_phone: string;
  };
  insured_vehicle?: {
    year: string;
    make: string;
    model: string;
    vin: string;
    license_plate: string;
    body_type: string;
    usage_class: string;
    mileage: string;
    garage_zip: string;
  };
}