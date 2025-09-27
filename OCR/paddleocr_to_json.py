import json
import numpy as np
from PIL import Image
import ollama
import re
import sys
import os
from datetime import datetime
from paddleocr import PaddleOCR
import requests
r = requests.get('https://ollama.xiltepin.me')
print(r.text)
# Set Ollama host to localhost
#os.environ['OLLAMA_HOST'] = 'http://127.0.0.1:11434'
os.environ['OLLAMA_HOST'] = 'https://ollama.xiltepin.me'

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
            print(f"PaddleOCR initialized with GPU: {use_gpu}")
        except Exception as e:
            print(f"PaddleOCR initialization failed: {e}")
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
        print("[DEBUG] PaddleOCR ocr() result:", result)
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
        prompt = f'''
You are an expert insurance document parser. Extract information from OCR text and return ONLY valid JSON.
CRITICAL: Your response must be ONLY the JSON structure below. No explanations, no markdown, no extra text.
Parse this OCR text from an auto insurance document:
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
'''
        return prompt
    
    def parse_with_ollama(self, raw_text, image_path):
        import traceback
        prompt = self.create_enhanced_prompt(raw_text, image_path)
        try:
            print("[DEBUG] Sending direct POST to Ollama remote API...")
            url = "http://127.0.0.1:11434/api/chat"
            payload = {
                "model": "llava:7b",
                "messages": [{"role": "user", "content": prompt}],
                "options": {
                    "temperature": 0.1,
                    "top_p": 0.9,
                    "num_predict": 4000
                }
            }
            headers = {"Content-Type": "application/json"}
            resp = requests.post(url, data=json.dumps(payload), headers=headers, timeout=120)
            print(f"[DEBUG] Ollama API status: {resp.status_code}")
            print(f"[DEBUG] Ollama API response (first 500 chars): {resp.text[:500]}")
            resp.raise_for_status()
            # Handle streaming JSON lines
            contents = []
            for line in resp.text.splitlines():
                line = line.strip()
                if not line:
                    continue
                try:
                    data = json.loads(line)
                    msg = data.get('message', {}).get('content', '')
                    if msg:
                        contents.append(msg)
                    if data.get('done', False):
                        break
                except Exception as e:
                    print(f"[DEBUG] Skipping non-JSON line: {line[:100]}... Error: {e}")
            content = ''.join(contents)
            print(f"Raw Ollama response length: {len(content)}")
            print(f"First 200 chars: {content[:200]}...")
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
            print(f"Cleaned content length: {len(content)}")
            print(f"Cleaned first 100 chars: {content[:100]}...")
            parsed_json = json.loads(content)
            print("[OK] JSON parsed successfully!")
            return parsed_json
        except json.JSONDecodeError as e:
            print(f"[ERROR] JSON parsing error: {e}")
            print(f"Problematic content (first 300 chars): {content[:300]}")
            try:
                content_fixed = content.replace("'", '"')
                parsed_json = json.loads(content_fixed)
                print("[OK] Fixed JSON by replacing single quotes!")
                return parsed_json
            except:
                print("[ERROR] Could not fix JSON, using fallback structure")
                return self._create_fallback_structure(image_path)
        except Exception as e:
            print(f"[ERROR] Ollama parsing error: {e!r}")
            print("[TRACEBACK]")
            traceback.print_exc()
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
        print(f"[INFO] Received file for processing: {image_path}")
        if not os.path.exists(image_path):
            raise FileNotFoundError(f"Image file not found: {image_path}")
        raw_data_dir = "raw_data"
        results_dir = os.path.join("Results", "JSON")
        os.makedirs(raw_data_dir, exist_ok=True)
        os.makedirs(results_dir, exist_ok=True)
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        # Extract text
        raw_text, detailed_ocr = self.extract_text(image_path)
        print(f"[INFO] OCR Confidence: {self.confidence_scores['ocr_confidence']:.2f}")
        print(f"[INFO] Raw OCR output (first 500 chars):\n{raw_text[:500] + '...' if len(raw_text) > 500 else raw_text}")
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
        print(f"[INFO] Raw data saved to: {raw_filename}")
        # Parse with Ollama
        extracted_data = self.parse_with_ollama(raw_text, image_path)
        # Log JSON output
        print(f"[INFO] JSON output:\n{json.dumps(extracted_data, ensure_ascii=False, indent=2)[:1000]}")
        accuracy_metrics = self.calculate_extraction_accuracy(extracted_data)
        extracted_data["accuracy_metrics"] = accuracy_metrics
        json_filename = os.path.join(results_dir, f"insurance_data_{timestamp}.json")
        with open(json_filename, "w", encoding="utf-8") as json_file:
            json.dump(extracted_data, json_file, ensure_ascii=False, indent=2)
        print(f"[INFO] JSON file saved to: {json_filename}")
        print(f"[INFO] Overall accuracy metrics:")
        print(f"  - OCR Confidence: {accuracy_metrics['ocr_confidence']:.1%}")
        print(f"  - Extraction Completeness: {accuracy_metrics['extraction_completeness']:.1f}%")
        return extracted_data, accuracy_metrics

def process_insurance_document(image_path, languages=['en']):
    extractor = InsuranceDocumentExtractor(languages=languages)
    return extractor.process_document(image_path)

if __name__ == "__main__":
    if len(sys.argv) > 1:
        image_path = sys.argv[1]
    else:
        image_path = "Test-Geico.jpg"
    if not image_path.lower().endswith(('.jpg', '.jpeg', '.png', '.bmp', '.pdf')):
        image_path += ".jpg"
    print(f"Processing image: {image_path}")
    try:
        data, metrics = process_insurance_document(image_path)
        print("\n[OK] Processing completed successfully!")
        if "--summary" in sys.argv:
            print("\n[SUMMARY] EXTRACTION SUMMARY:")
            policy_num = data.get('policy_information', {}).get('policy_number', {}).get('value', 'Not found')
            policy_holder = data.get('policy_holder', {}).get('full_name', {}).get('value', 'Not found')
            insurance_co = data.get('policy_information', {}).get('insurance_company', {}).get('value', 'Not found')
            print(f"Policy Number: {policy_num}")
            print(f"Policy Holder: {policy_holder}")
            print(f"Insurance Company: {insurance_co}")
    except FileNotFoundError:
        print(f"[ERROR] File '{image_path}' not found!")
        print("Make sure the image file is in the same directory as this script.")
        sys.exit(1)
    except Exception as e:
        print(f"[ERROR] Error processing document: {e}")
        sys.exit(1)
