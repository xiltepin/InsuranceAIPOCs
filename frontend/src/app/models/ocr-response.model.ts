export interface TextBlock {
  text: string;
  confidence: number;
  bbox: number[];
}

export interface OcrResponse {
  status: string;
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
}