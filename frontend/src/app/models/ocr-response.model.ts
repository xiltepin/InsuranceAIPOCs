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
}