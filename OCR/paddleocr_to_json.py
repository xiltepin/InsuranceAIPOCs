import json
import numpy as np
from PIL import Image
import ollama
import re
import sys
import textwrap
import os
from datetime import datetime
from paddleocr import PaddleOCR
import requests
import sys
# All logs/info to stderr, not stdout
try:
    r = requests.get('http://127.0.0.1:11434')
    print(r.text, file=sys.stderr)
except Exception as e:
    print(f"[ERROR] Ollama check failed: {e}", file=sys.stderr)
# Set Ollama host to localhost


class InsuranceDocumentExtractor:
    def preprocess_image(self, image_path):
        """Convert to grayscale and increase contrast, save to temp file, return new path."""
        from PIL import ImageEnhance
        img = Image.open(image_path).convert('L')  # Grayscale
        enhancer = ImageEnhance.Contrast(img)
        img = enhancer.enhance(2.0)  # Increase contrast
        temp_path = 'preprocessed_temp.jpg'
        img.save(temp_path)
        return temp_path
    def __init__(self, languages=['en'], use_gpu=True):
        # Initialize PaddleOCR with new API
        try:
            self.ocr = PaddleOCR(use_textline_orientation=True, lang=languages[0])
            print(f"[INFO] PaddleOCR initialized with GPU: {use_gpu}", file=sys.stderr)
        except Exception as e:
            print(f"[ERROR] PaddleOCR initialization failed: {e}", file=sys.stderr)
            raise
        self.confidence_scores = {}
    
    def extract_text(self, image_path):
        """Preprocess image, extract text with confidence scores using PaddleOCR (predict API), and debug print result."""
        # Check file extension
        if not image_path.lower().endswith((
            '.jpg', '.png', '.jpeg', '.bmp', '.pdf')):
            raise ValueError(f"Unsupported file type: {image_path}")
        # Preprocess image
        preprocessed_path = self.preprocess_image(image_path)
        # Perform OCR using predict()
        result = self.ocr.ocr(preprocessed_path)
        print("[DEBUG] PaddleOCR processing completed", file=sys.stderr, flush=True)
        text_blocks = []
        detailed_result = []
        total_confidence = 0
        count = 0
        # New: handle PaddleOCR dict result (v3+)
        if isinstance(result, list) and len(result) > 0 and isinstance(result[0], dict):
            ocr_dict = result[0]
            rec_texts = ocr_dict.get('rec_texts', [])
            rec_scores = ocr_dict.get('rec_scores', [])
            for i, text in enumerate(rec_texts):
                confidence = rec_scores[i] if i < len(rec_scores) else 0
                text_blocks.append(text)
                detailed_result.append((None, text, confidence))
                total_confidence += confidence
                count += 1
            raw_text = "\n".join(text_blocks).strip()
            avg_confidence = total_confidence / count if count > 0 else 0
        else:
            # fallback to old logic
            if isinstance(result, list) and len(result) > 1 and isinstance(result[1], list) and len(result[1]) > 0:
                for l in result[1]:
                    bbox = l[0]
                    text = l[1][0]
                    confidence = l[1][1]
                    text_blocks.append(text)
                    total_confidence += confidence
                    detailed_result.append((bbox, text, confidence))
                raw_text = "\n".join(text_blocks).strip()
                avg_confidence = total_confidence / len(detailed_result) if detailed_result else 0
            else:
                raw_text = ""
                avg_confidence = 0
        self.confidence_scores['ocr_confidence'] = avg_confidence
        return raw_text, detailed_result
    
    def create_enhanced_prompt(self, raw_text, image_path):
                current_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S JST")
                prompt = textwrap.dedent(f'''
                        You are an expert insurance document parser. Extract information from OCR text and return ONLY valid JSON.
                        CRITICAL: Your response must be ONLY the JSON structure below. No explanations, no markdown, no extra text.
                        Parse this OCR text from an auto insurance document and you should aim to finish in less than 30 seconds:
                        {raw_text}

                        Return this exact JSON structure with extracted values. If a value is missing, leave it as an empty string. You may add extra fields if found, but these are required for Angular display:
                        {{
                            "policy_number": "Value",
                            "effective_dates": {{
                                "start": "Value",
                                "end": "Value"
                            }},
                            "policyholder_details": {{
                                "full_name": "Value",
                                "address": "Value",
                                "city_state_zip": "Value",
                                "phone": "Value",
                                "email": "Value",
                                "dob": "Value",
                                "gender": "Value",
                                "marital_status": "Value"
                            }},
                            "policy_information": {{
                                "policy_type": "Value",
                                "issue_date": "Value",
                                "term_length": "Value",
                                "renewal_date": "Value",
                                "agent": "Value",
                                "agent_id": "Value",
                                "office_phone": "Value"
                            }},
                            "insured_vehicle": {{
                                "year": "Value",
                                "make": "Value",
                                "model": "Value",
                                "vin": "Value",
                                "license_plate": "Value",
                                "body_type": "Value",
                                "usage_class": "Value",
                                "mileage": "Value",
                                "garage_zip": "Value"
                            }},
                            "driver_profile": {{
                                "primary_driver_name": "Value",
                                "license_no": "Value",
                                "license_date": "Value",
                                "license_status": "Value",
                                "age_group": "Value",
                                "driving_record": "Value",
                                "relationship": "Value"
                            }},
                            "coverage_limits_and_deductibles": [
                                {{
                                    "coverage_type": "Value",
                                    "limit": "Value",
                                    "deductible": "Value",
                                    "premium": "Value"
                                }}
                                // ...repeat for each coverage type
                            ],
                            "discounts_applied": {{
                                "good_driver": "Value",
                                "multi_policy": "Value",
                                "vehicle_safety": "Value",
                                "federal_employee": "Value",
                                "total_savings": "Value"
                            }},
                            "billing_information": {{
                                "payment_method": "Value",
                                "payment_plan": "Value",
                                "monthly_amount": "Value",
                                "next_due_date": "Value",
                                "bank_account": "Value"
                            }}
                        }}
                        IMPORTANT: The coverage_limits_and_deductibles must be an array of objects, one per row in the table. Return ONLY this JSON structure. No other text.
                ''')
                return prompt
    #llama3.2:3b llava:7b
    def parse_with_ollama(self, raw_text, image_path):
        import traceback
        import time
        prompt = self.create_enhanced_prompt(raw_text, image_path)
        try:
            print("=" * 80, file=sys.stderr, flush=True)
            print("[PADDLEOCR SCRIPT]: About to send data to Ollama", file=sys.stderr, flush=True)
            print(f"[RAW TEXT LENGTH]: {len(raw_text)} characters", file=sys.stderr, flush=True)
            print(f"[PROMPT LENGTH]: {len(prompt)} characters", file=sys.stderr, flush=True) 
            print("=" * 80, file=sys.stderr, flush=True)
            print("[DEBUG] Sending direct POST to Ollama remote API...", file=sys.stderr, flush=True)
            url = "http://127.0.0.1:11434/api/chat"
            payload = {
                "model": "llama3.2:3b",
                "messages": [{"role": "user", "content": prompt}],
                "options": {
                    "temperature": 0.1,
                    "top_p": 0.9,
                    "num_predict": 4000
                }
            }
            headers = {"Content-Type": "application/json"}
            resp = requests.post(url, data=json.dumps(payload), headers=headers, timeout=120)
            print(f"[DEBUG] Ollama API status: {resp.status_code}", file=sys.stderr)
            resp.raise_for_status()
            # Progress bar setup
            num_predict = payload["options"]["num_predict"]
            total_chars = num_predict * 4  # estimate: 1 token ~ 4 chars
            contents = []
            chars_so_far = 0
            last_print = 0
            print("[PROGRESS] Parsing with Ollama:", file=sys.stderr)
            for line in resp.text.splitlines():
                line = line.strip()
                if not line:
                    continue
                try:
                    data = json.loads(line)
                    msg = data.get('message', {}).get('content', '')
                    if msg:
                        contents.append(msg)
                        chars_so_far += len(msg)
                        percent = min(100, int(chars_so_far / total_chars * 100))
                        # Print progress bar every 2%
                        if percent - last_print >= 2 or percent == 100:
                            bar = '[' + '#' * (percent // 4) + '-' * (25 - percent // 4) + f'] {percent}%'
                            print(f'\r{bar}', end='', flush=True, file=sys.stderr)
                            last_print = percent
                    if data.get('done', False):
                        break
                except Exception as e:
                    print(f"[DEBUG] Skipping non-JSON line: {line[:100]}... Error: {e}", file=sys.stderr)
            print(file=sys.stderr)  # Newline after progress bar
            content = ''.join(contents)
            print(f"Raw Ollama response length: {len(content)}", file=sys.stderr)
            print(f"First 200 chars: {content[:200]}...", file=sys.stderr)
            content = content.strip()
            if '```json' in content:
                start = content.find('```json') + 7
                end = content.find('```', start)
                if end != -1:
                    content = content[start:end]
            elif '```' in content:
                start = content.find('```') + 3
                end = content.rfind('```')
                if end != -1 and end > start:
                    content = content[start:end]
            if '{' in content and '}' in content:
                start = content.find('{')
                end = content.rfind('}') + 1
                content = content[start:end]
            # Fix escaped underscores (\_) to _
            content = content.replace('\\_', '_')
            print(f"Cleaned content length: {len(content)}", file=sys.stderr)
            print(f"Cleaned first 100 chars: {content[:100]}...", file=sys.stderr)
            parsed_json = json.loads(content)
            print("=" * 80, file=sys.stderr)
            print("[OLLAMA RESPONSE]: JSON parsed successfully!", file=sys.stderr)
            print(f"[PARSED JSON LENGTH]: {len(str(parsed_json))} characters", file=sys.stderr)
            print("=" * 80, file=sys.stderr)
            return parsed_json
        except json.JSONDecodeError as e:
            print(f"[ERROR] JSON parsing error: {e}", file=sys.stderr)
            print(f"Problematic content (first 300 chars): {content[:300]}", file=sys.stderr)
            try:
                content_fixed = content.replace("'", '"')
                parsed_json = json.loads(content_fixed)
                print("[OK] Fixed JSON by replacing single quotes!", file=sys.stderr)
                return parsed_json
            except:
                print("[ERROR] Could not fix JSON, using fallback structure", file=sys.stderr)
                return self._create_fallback_structure(image_path)
        except Exception as e:
            print(f"[ERROR] Ollama parsing error: {e!r}", file=sys.stderr)
            print("[TRACEBACK]", file=sys.stderr)
            traceback.print_exc(file=sys.stderr)
            return self._create_fallback_structure(image_path)
    
    def _create_fallback_structure(self, image_path):
        return {
            "document_metadata": {
                "filename": image_path,
                "extraction_timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S JST"),
                "document_language": "unknown",
                "document_type": "auto_insurance_policy"
            },
            "confidence_assessment": {
                "overall_confidence": "low",
                "extraction_error": "Failed to parse with Ollama"
            },
            "policy_holder": {},
            "policy_information": {},
            "vehicle_information": {},
            "coverage_details": {},
            "billing_information": {},
            "driver_information": {}
        }
    
    def calculate_extraction_accuracy(self, extracted_data):
        confidence_scores = {
            "ocr_confidence": self.confidence_scores.get('ocr_confidence', 0),
            "extraction_completeness": 0,
            "field_accuracy_estimates": {}
        }
        total_fields = 0
        filled_fields = 0
        def count_fields(data, prefix=""):
            nonlocal total_fields, filled_fields
            if isinstance(data, dict):
                for key, value in data.items():
                    if key == "confidence_assessment" or key == "document_metadata":
                        continue
                    if isinstance(value, dict):
                        if "value" in value and "confidence" in value:
                            total_fields += 1
                            if value["value"] and value["value"] != "":
                                filled_fields += 1
                                field_name = f"{prefix}.{key}" if prefix else key
                                confidence_scores["field_accuracy_estimates"][field_name] = value["confidence"]
                        else:
                            count_fields(value, f"{prefix}.{key}" if prefix else key)
        count_fields(extracted_data)
        confidence_scores["extraction_completeness"] = (filled_fields / total_fields * 100) if total_fields > 0 else 0
        return confidence_scores
    
    def process_document(self, image_path):
        print(f"[INFO] Received file for processing: {image_path}", file=sys.stderr, flush=True)
        if not os.path.exists(image_path):
            raise FileNotFoundError(f"Image file not found: {image_path}")
        raw_data_dir = "raw_data"
        results_dir = os.path.join("Results", "JSON")
        os.makedirs(raw_data_dir, exist_ok=True)
        os.makedirs(results_dir, exist_ok=True)
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        # Extract text
        raw_text, detailed_ocr = self.extract_text(image_path)
        print(f"[INFO] OCR Confidence: {self.confidence_scores['ocr_confidence']:.2f}", file=sys.stderr, flush=True)
        print(f"[INFO] Raw OCR output (first 500 chars):\n{raw_text[:500] + '...' if len(raw_text) > 500 else raw_text}", file=sys.stderr, flush=True)
        raw_filename = os.path.join(raw_data_dir, f"raw_{timestamp}.txt")
        with open(raw_filename, "w", encoding="utf-8") as raw_file:
            raw_file.write(f"Image: {image_path}\n")
            raw_file.write(f"Extraction Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S JST')}\n")
            raw_file.write(f"OCR Confidence: {self.confidence_scores['ocr_confidence']:.2%}\n")
            raw_file.write(f"Total Text Blocks: {len(detailed_ocr)}\n")
            raw_file.write("=" * 50 + "\n")
            raw_file.write("RAW OCR TEXT:\n")
            raw_file.write("=" * 50 + "\n")
            raw_file.write(raw_text)
            raw_file.write("\n" + "=" * 50 + "\n")
            raw_file.write("DETAILED OCR RESULTS:\n")
            raw_file.write("=" * 50 + "\n")
            for i, (bbox, text, confidence) in enumerate(detailed_ocr):
                raw_file.write(f"Block {i+1}: {text} (confidence: {confidence:.2%})\n")
                raw_file.write(f"  Position: {bbox}\n\n")
        print(f"[INFO] Raw data saved to: {raw_filename}", file=sys.stderr)
        
        # LOG COMPLETE RAW TEXT BEFORE SENDING TO OLLAMA
        print("=" * 80, file=sys.stderr, flush=True)
        print("[COMPLETE RAW OCR TEXT BEFORE OLLAMA]", file=sys.stderr, flush=True)
        print("=" * 80, file=sys.stderr, flush=True)
        print(raw_text, file=sys.stderr, flush=True)
        print("=" * 80, file=sys.stderr, flush=True)
        print(f"[RAW TEXT LENGTH]: {len(raw_text)} characters", file=sys.stderr, flush=True)
        print("=" * 80, file=sys.stderr, flush=True)
        
        # Re-enabled Ollama processing to utilize Tesla P100 GPU for enhanced data extraction
        print("=" * 80, file=sys.stderr, flush=True)
        print("[ENABLING OLLAMA]: Using Tesla P100 GPU to enhance raw data extraction", file=sys.stderr, flush=True)
        print("=" * 80, file=sys.stderr, flush=True)
        
        # Process with Ollama for structured extraction and field enhancement
        extracted_data = self.parse_with_ollama(raw_text, image_path)
        
        # Ensure raw OCR text is included in response (truncated to prevent HTTP response issues)
        if extracted_data:
            # Truncate raw OCR text to first 500 characters to prevent large HTTP responses
            extracted_data["raw_ocr_text"] = raw_text[:500] + "..." if len(raw_text) > 500 else raw_text
            # Update metadata to reflect GPU processing
            if "document_metadata" in extracted_data:
                extracted_data["document_metadata"]["processing_method"] = "paddleocr_plus_ollama_gpu"
            else:
                extracted_data["document_metadata"] = {
                    "filename": image_path,
                    "extraction_timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S JST"),
                    "document_language": "en", 
                    "document_type": "auto_insurance_policy",
                    "processing_method": "paddleocr_plus_ollama_gpu"
                }
        # Log JSON output
        print(f"[INFO] JSON output:\n{json.dumps(extracted_data, ensure_ascii=False, indent=2)[:1000]}", file=sys.stderr)
        accuracy_metrics = self.calculate_extraction_accuracy(extracted_data)
        extracted_data["accuracy_metrics"] = accuracy_metrics
        json_filename = os.path.join(results_dir, f"insurance_data_{timestamp}.json")
        with open(json_filename, "w", encoding="utf-8") as json_file:
            json.dump(extracted_data, json_file, ensure_ascii=False, indent=2)
        print(f"[INFO] JSON file saved to: {json_filename}", file=sys.stderr)
        print(f"[INFO] Overall accuracy metrics:", file=sys.stderr)
        # Print confidence bar
        conf = accuracy_metrics.get('ocr_confidence', 0)
        bar_len = 30
        filled = int(conf * bar_len)
        bar = '[' + '#' * filled + '-' * (bar_len - filled) + f'] {conf:.1%} confidence'
        print(bar, file=sys.stderr)
        print(f"  - OCR Confidence: {accuracy_metrics['ocr_confidence']:.1%}", file=sys.stderr)
        print(f"  - Extraction Completeness: {accuracy_metrics['extraction_completeness']:.1f}%", file=sys.stderr)
        return extracted_data, accuracy_metrics

def process_insurance_document(image_path, languages=['en']):
    extractor = InsuranceDocumentExtractor(languages=languages)
    return extractor.process_document(image_path)

if __name__ == "__main__":
    # Check if processing raw text directly
    if "--raw-text" in sys.argv:
        try:
            raw_text_index = sys.argv.index("--raw-text")
            if raw_text_index + 1 < len(sys.argv):
                raw_text = sys.argv[raw_text_index + 1]
                print(f"Processing raw text directly (length: {len(raw_text)})", file=sys.stderr)
                
                # Initialize the extractor
                extractor = InsuranceDocumentExtractor()
                
                # Process the raw text through Ollama directly
                start_time = datetime.now()
                processed_data = extractor.parse_with_ollama(raw_text, "raw_text_input")
                end_time = datetime.now()
                
                # Calculate timing (no PaddleOCR time since we bypass it)
                ai_processing_time = (end_time - start_time).total_seconds()
                
                # Add timing information
                processed_data['processing_metrics'] = {
                    'paddleocr_time_seconds': 0.0,  # No PaddleOCR processing
                    'ai_processing_time_seconds': ai_processing_time,
                    'total_time_seconds': ai_processing_time,
                    'raw_text_processing': True
                }
                
                # Output JSON result
                print(json.dumps(processed_data, ensure_ascii=False, indent=2))
                print("[OK] Raw text processing completed successfully!", file=sys.stderr)
                sys.exit(0)
            else:
                print("[ERROR] --raw-text flag provided but no text content found", file=sys.stderr)
                sys.exit(1)
        except Exception as e:
            print(f"[ERROR] Error processing raw text: {e}", file=sys.stderr)
            sys.exit(1)
    
    # Standard image processing
    if len(sys.argv) > 1 and not sys.argv[1].startswith("--"):
        image_path = sys.argv[1]
    else:
        image_path = "Test-Geico.jpg"
    if not image_path.lower().endswith(('.jpg', '.jpeg', '.png', '.bmp', '.pdf')):
        image_path += ".jpg"
    print(f"Processing image: {image_path}", file=sys.stderr)
    try:
        data, metrics = process_insurance_document(image_path)
        # Only print the JSON to stdout, nothing else
        print(json.dumps(data, ensure_ascii=False, indent=2))
        # All other info to stderr
        print("[OK] Processing completed successfully!", file=sys.stderr)
        if "--summary" in sys.argv:
            print("[SUMMARY] EXTRACTION SUMMARY:", file=sys.stderr)
            policy_num = data.get('policy_information', {}).get('policy_number', {}).get('value', 'Not found')
            policy_holder = data.get('policy_holder', {}).get('full_name', {}).get('value', 'Not found')
            insurance_co = data.get('policy_information', {}).get('insurance_company', {}).get('value', 'Not found')
            print(f"Policy Number: {policy_num}", file=sys.stderr)
            print(f"Policy Holder: {policy_holder}", file=sys.stderr)
            print(f"Insurance Company: {insurance_co}", file=sys.stderr)
    except FileNotFoundError:
        print(f"[ERROR] File '{image_path}' not found!", file=sys.stderr)
        print("Make sure the image file is in the same directory as this script.", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"[ERROR] Error processing document: {e}", file=sys.stderr)
        sys.exit(1)
