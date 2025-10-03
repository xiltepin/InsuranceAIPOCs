#!/usr/bin/env python3

import os
import sys
import json
import requests
from datetime import datetime
from PIL import Image
import tempfile

# PDF processing imports
try:
    import fitz  # PyMuPDF
    PDF_SUPPORT = True
    print("[SUCCESS] PyMuPDF imported - PDF support enabled", file=sys.stderr)
except ImportError:
    PDF_SUPPORT = False
    print("[WARNING] PyMuPDF not found - PDF support disabled", file=sys.stderr)

try:
    from paddleocr import PaddleOCR
    print("[SUCCESS] PaddleOCR imported successfully", file=sys.stderr)
except ImportError as e:
    print(f"[ERROR] Failed to import PaddleOCR: {e}", file=sys.stderr)
    sys.exit(1)

class FastInsuranceExtractor:
    def __init__(self, init_ocr=True):
        # Initialize OCR only if needed (for images/PDFs)
        self.ocr = None
        if init_ocr:
            try:
                self.ocr = PaddleOCR(
                    lang='en',
                    use_textline_orientation=False  # Updated parameter name to avoid deprecation
                )
                print(f"[INFO] PaddleOCR initialized for fast processing", file=sys.stderr)
            except Exception as e:
                print(f"[ERROR] PaddleOCR initialization failed: {e}", file=sys.stderr)
                raise
        else:
            print(f"[INFO] Skipping PaddleOCR initialization for text-only processing", file=sys.stderr)
        self.confidence_scores = {}
    
    def _ensure_ocr_initialized(self):
        """Initialize OCR if not already done (lazy initialization)"""
        if self.ocr is None:
            try:
                self.ocr = PaddleOCR(
                    lang='en',
                    use_textline_orientation=False
                )
                print(f"[INFO] PaddleOCR initialized (lazy loading)", file=sys.stderr)
            except Exception as e:
                print(f"[ERROR] PaddleOCR initialization failed: {e}", file=sys.stderr)
                raise
    
    def convert_pdf_to_images(self, pdf_path):
        """Convert PDF pages to images for OCR processing"""
        if not PDF_SUPPORT:
            raise ImportError("PDF support requires PyMuPDF. Install with: pip install PyMuPDF")
        
        images = []
        doc = None
        try:
            doc = fitz.open(pdf_path)
            print(f"[INFO] Converting PDF with {len(doc)} pages to images", file=sys.stderr)
            
            for page_num in range(len(doc)):
                page = doc.load_page(page_num)
                # Convert page to image (300 DPI for good OCR quality)
                mat = fitz.Matrix(300/72, 300/72)  # 300 DPI scaling
                pix = page.get_pixmap(matrix=mat)
                
                # Save as temporary image with proper file handling
                temp_fd, temp_path = tempfile.mkstemp(suffix='.png')
                try:
                    os.close(temp_fd)  # Close file descriptor immediately
                    pix.save(temp_path)
                    images.append(temp_path)
                    print(f"[INFO] Converted PDF page {page_num + 1}/{len(doc)} to {temp_path}", file=sys.stderr)
                except Exception as save_error:
                    print(f"[ERROR] Failed to save page {page_num + 1}: {save_error}", file=sys.stderr)
                    try:
                        os.unlink(temp_path)
                    except:
                        pass
                    raise
            
            return images
        except Exception as e:
            print(f"[ERROR] PDF conversion failed: {e}", file=sys.stderr)
            raise
        finally:
            if doc:
                doc.close()
    
    def extract_text_from_pdf(self, pdf_path):
        """Extract text from PDF by converting pages to images and running OCR"""
        print(f"[INFO] Processing PDF: {pdf_path}", file=sys.stderr)
        
        # Convert PDF to images
        temp_images = self.convert_pdf_to_images(pdf_path)
        
        all_text_blocks = []
        all_detailed_results = []
        combined_text = []
        total_confidence = 0
        total_count = 0
        
        try:
            for i, image_path in enumerate(temp_images):
                print(f"[INFO] Processing PDF page {i + 1}/{len(temp_images)}", file=sys.stderr)
                
                # Process each page image with OCR
                page_text, page_detailed = self.extract_text_from_image(image_path)
                
                print(f"[DEBUG] Page {i + 1} detailed type: {type(page_detailed[0]) if page_detailed else 'empty'}", file=sys.stderr)
                
                # Add page separator
                if combined_text:
                    combined_text.append(f"\\n--- PAGE {i + 1} ---\\n")
                combined_text.append(page_text)
                
                # Combine detailed results
                all_detailed_results.extend(page_detailed)
                
                # Update confidence tracking
                if page_detailed:
                    # Handle tuple format: (bbox, text, confidence)
                    page_confidences = [item[2] if isinstance(item, tuple) and len(item) >= 3 else 0 for item in page_detailed]
                    total_confidence += sum(page_confidences)
                    total_count += len(page_confidences)
            
            # Clean up temporary images
            for temp_image in temp_images:
                try:
                    if os.path.exists(temp_image):
                        os.unlink(temp_image)
                        print(f"[DEBUG] Cleaned up {temp_image}", file=sys.stderr)
                except Exception as cleanup_error:
                    print(f"[WARN] Could not clean up {temp_image}: {cleanup_error}", file=sys.stderr)
            
            # Calculate overall confidence
            if total_count > 0:
                self.confidence_scores['ocr_confidence'] = total_confidence / total_count
            
            combined_raw_text = "\\n".join(combined_text)
            print(f"[INFO] PDF processing completed: {len(all_detailed_results)} total text blocks", file=sys.stderr)
            
            return combined_raw_text, all_detailed_results
            
        except Exception as e:
            # Clean up on error
            for temp_image in temp_images:
                try:
                    if os.path.exists(temp_image):
                        os.unlink(temp_image)
                except Exception as cleanup_error:
                    print(f"[WARN] Error cleanup failed for {temp_image}: {cleanup_error}", file=sys.stderr)
            raise e
    
    def extract_text_from_image(self, image_path):
        """Extract text from a single image file"""
        # Ensure OCR is initialized for image processing
        self._ensure_ocr_initialized()
        
        try:
            # Use the predict method as recommended (replaces deprecated ocr method)
            # Note: cls parameter not supported in predict method, only use_angle_cls in constructor
            result = self.ocr.predict(image_path)
        except Exception as e:
            print(f"[ERROR] OCR processing failed: {e}", file=sys.stderr)
            raise
        
        return self.process_ocr_result(result)
    
    def extract_text_from_txt(self, txt_path):
        """Extract text from a plain text file"""
        print(f"[INFO] Processing text file: {txt_path}", file=sys.stderr)
        
        try:
            with open(txt_path, 'r', encoding='utf-8') as file:
                raw_text = file.read()
            
            print(f"[INFO] Loaded text file with {len(raw_text)} characters", file=sys.stderr)
            
            # Create fake detailed results for consistency with OCR pipeline
            lines = raw_text.split('\n')
            detailed_result = []
            
            for i, line in enumerate(lines):
                if line.strip():
                    detailed_result.append((f"Line_{i+1}", line.strip(), 1.0))
            
            return raw_text, detailed_result
            
        except Exception as e:
            print(f"[ERROR] Failed to read text file: {e}", file=sys.stderr)
            raise

    def extract_text(self, file_path):
        """Fast text extraction - supports images, PDFs, and text files"""
        # Verify file exists first
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"File not found: {file_path}")
        
        # Check file type and process accordingly
        if file_path.lower().endswith('.pdf'):
            return self.extract_text_from_pdf(file_path)
        elif file_path.lower().endswith('.txt'):
            return self.extract_text_from_txt(file_path)
        else:
            print(f"[INFO] Processing image: {file_path}", file=sys.stderr)
            # Process as image file
            return self.extract_text_from_image(file_path)
    
    def process_ocr_result(self, result):
        """Process OCR result and extract text blocks with confidence scores"""
        text_blocks = []
        detailed_result = []
        total_confidence = 0
        count = 0
        
        # Handle PaddleOCR result format - newer versions return OCRResult objects
        print(f"[DEBUG] OCR result type: {type(result)}", file=sys.stderr)
        
        if result and len(result) > 0:
            for page_idx, page_result in enumerate(result):
                print(f"[DEBUG] Page result type: {type(page_result)}", file=sys.stderr)
                
                if hasattr(page_result, 'get') and 'rec_texts' in page_result:
                    # New OCRResult format - extract from rec_texts, dt_polys, rec_scores
                    try:
                        rec_texts = page_result.get('rec_texts', [])
                        dt_polys = page_result.get('dt_polys', [])
                        rec_scores = page_result.get('rec_scores', [])
                        
                        print(f"[INFO] Found {len(rec_texts)} text items in OCRResult", file=sys.stderr)
                        
                        for i, text in enumerate(rec_texts):
                            if text and text.strip():  # Only process non-empty text
                                confidence = rec_scores[i] if i < len(rec_scores) else 0.9
                                bbox = dt_polys[i] if i < len(dt_polys) else f"bbox_{i}"
                                
                                text_blocks.append(text.strip())
                                detailed_result.append((str(bbox), text.strip(), confidence))
                                total_confidence += confidence
                                count += 1
                                
                    except Exception as ocr_error:
                        print(f"[ERROR] OCRResult processing failed: {ocr_error}", file=sys.stderr)
                        # Fallback to basic iteration
                        for i, item in enumerate(page_result):
                            if isinstance(item, str) and item.strip():
                                text = item.strip()
                                text_blocks.append(text)
                                detailed_result.append((f"bbox_{i}", text, 0.9))
                                total_confidence += 0.9
                                count += 1
                                
                elif isinstance(page_result, (list, tuple)):
                    # Traditional format [bbox, (text, confidence)]
                    for i, line in enumerate(page_result):
                        try:
                            if isinstance(line, (list, tuple)) and len(line) >= 2:
                                bbox = line[0]
                                text_info = line[1]
                                
                                # Safely extract text and confidence
                                if isinstance(text_info, (list, tuple)) and len(text_info) >= 2:
                                    text = str(text_info[0]) if text_info[0] is not None else ""
                                    confidence = float(text_info[1]) if text_info[1] is not None else 0.0
                                else:
                                    text = str(text_info) if text_info is not None else ""
                                    confidence = 0.9  # Default confidence
                                
                                if text.strip():  # Only add non-empty text
                                    text_blocks.append(text)
                                    detailed_result.append((bbox, text, confidence))
                                    total_confidence += confidence
                                    count += 1
                                    
                        except Exception as line_error:
                            print(f"[ERROR] Error processing line {i}: {line_error}", file=sys.stderr)
                            continue  # Skip this line and continue processing
                            
                else:
                    # Unknown format - try basic iteration
                    print(f"[WARN] Unknown OCR result format, attempting basic iteration", file=sys.stderr)
                    try:
                        for i, item in enumerate(page_result):
                            if isinstance(item, str) and item.strip():
                                text = item.strip()
                                text_blocks.append(text)
                                detailed_result.append((f"bbox_{i}", text, 0.9))
                                total_confidence += 0.9
                                count += 1
                    except Exception as iter_error:
                        print(f"[ERROR] Basic iteration failed: {iter_error}", file=sys.stderr)
        
        raw_text = "\\n".join(text_blocks).strip()
        avg_confidence = total_confidence / count if count > 0 else 0
        self.confidence_scores['ocr_confidence'] = avg_confidence
        
        return raw_text, detailed_result
    
    def create_fast_prompt(self, raw_text):
        """Optimized prompt with comprehensive field extraction and better matching"""
        
        # Clean and filter the raw text to focus on important information
        cleaned_text = self.filter_important_text(raw_text)
        
        # Adjust text length based on content size to prevent timeouts
        # Allow opt-in faster prompt length when OLLAMA_FAST_MODE is enabled
        try:
            fast_mode = os.getenv('OLLAMA_FAST_MODE', '0') == '1'
        except Exception:
            fast_mode = False
        default_cap = 700 if fast_mode else 1000
        max_length = min(default_cap, len(cleaned_text))  # Cap prompt length
        text_snippet = cleaned_text[:max_length]
        
        # More direct and explicit prompt for better field extraction
        prompt = f"""Extract data from this insurance document text and return JSON:

{text_snippet}

Extract these fields into nested JSON structure:

POLICY LEVEL:
- policy_number: Text immediately after "Policy Number:" or alphanumeric code starting with letters

EFFECTIVE DATES:
- start: Date after "Effective Date:", "Effective:" (format: Month Day, Year)
- end: Date after "Expiration:", "Expiration Date:" or second date after effective

POLICYHOLDER DETAILS:
- full_name: Text after "Full Name:", "Name:", or under "NAMED INSURED" section
- address: Text after "Address:" label
- city_state_zip: Text after "City/State/ZIP:", "City/State:", or combine city and state info
- phone: Phone number pattern after "Phone:" label
- email: Email address pattern after "Email:" label
- dob: Date after "DOB:", "Date of Birth:" label
- gender: Text after "Gender:" label
- marital_status: Text after "Marital Status:" label

POLICY INFORMATION:
- policy_type: Text after "Policy Type:" label
- issue_date: Date after "Issue Date:" label (if available)
- term_length: Text after "Term:" or "Term Length:" label
- renewal_date: Date after "Renewal Date:" or calculate from effective + term
- agent: Name after "Agent:" label
- agent_id: Code/ID after "Agent ID:" label (if available)
- office_phone: Phone number after "Agent Phone:" or "Office Phone:" label

INSURED VEHICLE:
- year: 4-digit year from "Year/Make/Model:" or vehicle description
- make: Brand name from "Year/Make/Model:" or vehicle description  
- model: Model name from "Year/Make/Model:" or vehicle description
- vin: Alphanumeric code after "VIN:" or "VIN Number:"
- license_plate: Plate number after "License Plate:" label
- body_type: Vehicle type after "Body Type:" label (if available)
- usage_class: Text after "Usage:" or "Usage Class:" label
- mileage: Number + "miles" after "Annual Mileage:" label
- garage_zip: ZIP code from address or after garaging info

Return JSON with this EXACT structure:
{{"policy_number":"","effective_dates":{{"start":"","end":""}},"policyholder_details":{{"full_name":"","address":"","city_state_zip":"","phone":"","email":"","dob":"","gender":"","marital_status":""}},"policy_information":{{"policy_type":"","issue_date":"","term_length":"","renewal_date":"","agent":"","agent_id":"","office_phone":""}},"insured_vehicle":{{"year":"","make":"","model":"","vin":"","license_plate":"","body_type":"","usage_class":"","mileage":"","garage_zip":""}}}}

Match patterns exactly as they appear after the labels. Return only JSON."""
        
        return prompt
    
    def filter_important_text(self, raw_text):
        """Filter OCR text to focus on insurance-relevant content"""
        lines = raw_text.split('\n')
        important_lines = []
        
        # Keywords that indicate important insurance information (generic patterns only)
        important_keywords = [
            'policy', 'effective', 'policyholder', 'insured', 'vehicle', 
            'year', 'make', 'model', 'vin', 'phone', 'address', 'name', 'full name',
            'coverage', 'premium', 'deductible', 'liability', 'collision',
            'term', 'renewal', 'agent', 'producer', 'broker', 'office',
            'license', 'plate', 'body', 'usage', 'mileage', 'garage', 'garaging',
            'months', 'date', 'zip', 'gender', 'married', 'single', 'email',
            'named', 'expiration', 'birth', 'automobile', 'farm'
        ]
        
        for line in lines:
            line_lower = line.lower().strip()
            if any(keyword in line_lower for keyword in important_keywords):
                important_lines.append(line.strip())
            # Also include lines with numbers (likely dates, policy numbers, etc.)
            elif any(char.isdigit() for char in line) and len(line.strip()) > 3:
                important_lines.append(line.strip())
        
        # If we filtered too much, fall back to original text
        if len(important_lines) < 5:
            return raw_text
        
        filtered_text = '\n'.join(important_lines)
        print(f"[INFO] Filtered text from {len(raw_text)} to {len(filtered_text)} characters", file=sys.stderr)
        return filtered_text
    
    def fast_ollama_call(self, prompt):
        """Highly optimized Ollama API call with improved context and parameters"""
        url = "http://127.0.0.1:11434/api/generate"
        
        # Log the actual prompt being sent for debugging
        print(f"[INFO] Sending prompt to Ollama (length: {len(prompt)} chars)", file=sys.stderr)
        print(f"[DEBUG] Prompt preview: {prompt[:200]}...", file=sys.stderr)
        
        # Support an opt-in fast mode that lowers latency by reducing
        # num_predict/num_ctx and prompt length. This is disabled by default
        # to preserve maximum accuracy. Enable by setting OLLAMA_FAST_MODE=1
        try:
            fast_mode = os.getenv('OLLAMA_FAST_MODE', '0') == '1'
        except Exception:
            fast_mode = False

        if fast_mode:
            options = {
                "temperature": 0.0,
                "num_predict": 300,
                "num_ctx": 2048,
                "num_gpu": 99,
                "repeat_penalty": 1.0,
                "top_p": 0.15,
                "top_k": 40
            }
            timeout_seconds = int(os.getenv('OLLAMA_FAST_TIMEOUT', '45'))
            print(f"[INFO] Ollama FAST mode enabled: num_predict={options['num_predict']}, num_ctx={options['num_ctx']}, timeout={timeout_seconds}s", file=sys.stderr)
        else:
            options = {
                "temperature": 0.0,   # Zero temperature for deterministic output
                "num_predict": 600,   # Increased for more complete field extraction
                "num_ctx": 4096,     # Increased context size to handle larger prompts
                "num_gpu": 99,       # Use all GPU layers
                "repeat_penalty": 1.0,
                "top_p": 0.2,        # Slightly increased for better field matching
                "top_k": 20          # Increased for better vocabulary access
            }
            timeout_seconds = int(os.getenv('OLLAMA_TIMEOUT', '120'))

        payload = {
            "model": os.getenv('OLLAMA_MODEL', 'llama3.2:3b'),
            "prompt": prompt,
            "stream": False,
            "options": options
        }

        headers = {"Content-Type": "application/json"}
        # Call Ollama with an adjustable timeout
        resp = requests.post(url, data=json.dumps(payload), headers=headers, timeout=timeout_seconds)
        resp.raise_for_status()
        
        response_data = resp.json()
        content = response_data.get('response', '')
        
        return content
    
    def parse_json_response(self, content):
        """Enhanced JSON parsing with better error handling"""
        original_content = content
        content = content.strip()
        
        # Debug: Print raw AI response (more of it)
        print(f"[DEBUG] Raw AI response: {content[:500]}...", file=sys.stderr)
        print(f"[DEBUG] Full response length: {len(content)}", file=sys.stderr)
        
        # Find JSON boundaries - look for complete JSON object
        if '{' in content and '}' in content:
            start = content.find('{')
            # Find the matching closing brace
            brace_count = 0
            end = len(content)  # Default to end if no matching brace found
            
            for i in range(start, len(content)):
                char = content[i]
                if char == '{':
                    brace_count += 1
                elif char == '}':
                    brace_count -= 1
                    if brace_count == 0:
                        end = i + 1
                        break
            
            json_content = content[start:end]
            print(f"[DEBUG] Extracted JSON length: {len(json_content)}", file=sys.stderr)
            print(f"[DEBUG] Extracted JSON: {json_content[:200]}...", file=sys.stderr)
        else:
            json_content = content
            print(f"[DEBUG] No braces found, using full content", file=sys.stderr)
        
        try:
            parsed = json.loads(json_content)
            print(f"[INFO] Successfully parsed JSON with keys: {list(parsed.keys())}", file=sys.stderr)
            return parsed
        except json.JSONDecodeError as e:
            print(f"[ERROR] JSON parsing failed: {e}", file=sys.stderr)
            print(f"[ERROR] Attempted to parse: {json_content[:200]}...", file=sys.stderr)
            # Fallback: create structure matching Angular frontend expectations
            return {
                "policy_number": "",
                "effective_dates": {"start": "", "end": ""},
                "policyholder_details": {
                    "full_name": "",
                    "address": "",
                    "city_state_zip": "",
                    "phone": "",
                    "email": "",
                    "dob": "",
                    "gender": "",
                    "marital_status": ""
                },
                "policy_information": {
                    "policy_type": "",
                    "issue_date": "",
                    "term_length": "",
                    "renewal_date": "",
                    "agent": "",
                    "agent_id": "",
                    "office_phone": ""
                },
                "insured_vehicle": {
                    "year": "",
                    "make": "",
                    "model": "",
                    "vin": "",
                    "license_plate": "",
                    "body_type": "",
                    "usage_class": "",
                    "mileage": "",
                    "garage_zip": ""
                }
            }
    
    def process_document(self, image_path):
        """Fast document processing pipeline"""
        start_time = datetime.now()
        
        # Step 1: Fast OCR
        ocr_start = datetime.now()
        raw_text, detailed_ocr = self.extract_text(image_path)
        ocr_time = (datetime.now() - ocr_start).total_seconds()
        
        print(f"[INFO] OCR completed in {ocr_time:.2f}s", file=sys.stderr)
        print(f"[INFO] Extracted {len(detailed_ocr)} text blocks", file=sys.stderr)
        
        # Step 2: Fast AI processing
        ai_start = datetime.now()
        prompt = self.create_fast_prompt(raw_text)
        content = self.fast_ollama_call(prompt)
        extracted_data = self.parse_json_response(content)
        ai_time = (datetime.now() - ai_start).total_seconds()
        
        print(f"[INFO] AI processing completed in {ai_time:.2f}s", file=sys.stderr)
        
        # Step 3: Add metadata
        total_time = (datetime.now() - start_time).total_seconds()
        
        # Add text blocks for frontend
        extracted_data["text_blocks"] = []
        for i, (bbox, text, confidence) in enumerate(detailed_ocr):
            text_block = {
                "text": text,
                "confidence": confidence,
                "bbox": str(bbox) if bbox else f"Block {i+1}"
            }
            extracted_data["text_blocks"].append(text_block)
        
        # Add metadata
        extracted_data["raw_ocr_text"] = raw_text[:500] + "..." if len(raw_text) > 500 else raw_text
        extracted_data["document_metadata"] = {
            "filename": image_path,
            "extraction_timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S JST"),
            "document_language": "en",
            "document_type": "auto_insurance_policy",
            "processing_method": "fast_paddleocr_plus_ollama_gpu"
        }
        
        # Add accuracy metrics
        extracted_data["accuracy_metrics"] = {
            "ocr_confidence": self.confidence_scores.get('ocr_confidence', 0),
            "extraction_completeness": 0,  # Will be calculated by frontend
            "field_accuracy_estimates": {}
        }
        
        # Add processing metrics
        extracted_data["processing_metrics"] = {
            "paddleocr_time_seconds": ocr_time,
            "ai_processing_time_seconds": ai_time,
            "total_time_seconds": total_time
        }
        
        print(f"[SUCCESS] Total processing time: {total_time:.2f}s", file=sys.stderr)
        return extracted_data

if __name__ == "__main__":
    # Handle raw text processing
    if "--raw-text" in sys.argv:
        try:
            raw_text_index = sys.argv.index("--raw-text")
            if raw_text_index + 1 < len(sys.argv):
                raw_text = sys.argv[raw_text_index + 1]
                print(f"Processing raw text directly (length: {len(raw_text)})", file=sys.stderr)
                
                extractor = FastInsuranceExtractor()
                start_time = datetime.now()
                
                prompt = extractor.create_fast_prompt(raw_text)
                content = extractor.fast_ollama_call(prompt)
                processed_data = extractor.parse_json_response(content)
                
                ai_processing_time = (datetime.now() - start_time).total_seconds()
                
                # Add processing metrics
                processed_data['processing_metrics'] = {
                    'paddleocr_time_seconds': 0.0,
                    'ai_processing_time_seconds': ai_processing_time,
                    'total_time_seconds': ai_processing_time,
                    'raw_text_processing': True
                }
                
                # Create text blocks from raw text lines
                processed_data["text_blocks"] = []
                lines = raw_text.split('\\n')
                for i, line in enumerate(lines):
                    if line.strip():
                        text_block = {
                            "text": line.strip(),
                            "confidence": 1.0,
                            "bbox": f"Line {i+1}"
                        }
                        processed_data["text_blocks"].append(text_block)
                
                processed_data["raw_ocr_text"] = raw_text[:500] + "..." if len(raw_text) > 500 else raw_text
                
                print(json.dumps(processed_data, ensure_ascii=False, indent=2))
                print(f"[SUCCESS] Raw text processing completed in {ai_processing_time:.2f}s", file=sys.stderr)
                sys.exit(0)
        except Exception as e:
            print(f"[ERROR] Error processing raw text: {e}", file=sys.stderr)
            sys.exit(1)
    
    # Handle file processing (images, PDFs, or text files)
    if len(sys.argv) > 1 and not sys.argv[1].startswith("--"):
        file_path = sys.argv[1]
    else:
        print("[ERROR] No file path provided", file=sys.stderr)
        sys.exit(1)
    
    try:
        # Check if it's a text file to optimize initialization
        is_text_file = file_path.lower().endswith('.txt')
        
        # Initialize extractor with or without OCR based on file type
        extractor = FastInsuranceExtractor(init_ocr=not is_text_file)
        result = extractor.process_document(file_path)
        print(json.dumps(result, ensure_ascii=False, indent=2))
    except Exception as e:
        print(f"[ERROR] Processing failed: {e}", file=sys.stderr)
        sys.exit(1)