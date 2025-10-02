#!/usr/bin/env python3

import os
import sys
import json
import requests
from datetime import datetime
from PIL import Image
import tempfile

try:
    from paddleocr import PaddleOCR
    print("[SUCCESS] PaddleOCR imported successfully", file=sys.stderr)
except ImportError as e:
    print(f"[ERROR] Failed to import PaddleOCR: {e}", file=sys.stderr)
    sys.exit(1)

class FastInsuranceExtractor:
    def __init__(self):
        # Minimal PaddleOCR setup for speed
        try:
            self.ocr = PaddleOCR(lang='en', show_log=False)
            print(f"[INFO] PaddleOCR initialized for fast processing", file=sys.stderr)
        except Exception as e:
            print(f"[ERROR] PaddleOCR initialization failed: {e}", file=sys.stderr)
            raise
        self.confidence_scores = {}
    
    def extract_text(self, image_path):
        """Fast OCR extraction with minimal preprocessing"""
        # Simple OCR call without heavy preprocessing
        result = self.ocr.ocr(image_path)
        
        text_blocks = []
        detailed_result = []
        total_confidence = 0
        count = 0
        
        # Handle PaddleOCR result format
        if isinstance(result, list) and len(result) > 0:
            page_result = result[0]  # First page
            if page_result:  # Check if not None
                for line in page_result:
                    if len(line) >= 2:
                        bbox = line[0]
                        text_info = line[1]
                        text = text_info[0]
                        confidence = text_info[1]
                        
                        text_blocks.append(text)
                        detailed_result.append((bbox, text, confidence))
                        total_confidence += confidence
                        count += 1
        
        raw_text = "\\n".join(text_blocks).strip()
        avg_confidence = total_confidence / count if count > 0 else 0
        self.confidence_scores['ocr_confidence'] = avg_confidence
        
        return raw_text, detailed_result
    
    def create_fast_prompt(self, raw_text):
        """Ultra-short prompt for maximum processing speed"""
        # Use only first 600 characters to reduce processing time
        short_text = raw_text[:600] if len(raw_text) > 600 else raw_text
        
        prompt = f"""Extract insurance JSON from: {short_text}

Return only this JSON structure:
{{"policy_number":"","effective_dates":{{"start":"","end":""}},"policyholder_details":{{"full_name":"","address":"","city_state_zip":"","phone":"","email":"","dob":"","gender":"","marital_status":""}},"policy_information":{{"policy_type":"","issue_date":"","term_length":"","renewal_date":"","agent":"","agent_id":"","office_phone":""}},"insured_vehicle":{{"year":"","make":"","model":"","vin":"","license_plate":"","body_type":"","usage_class":"","mileage":"","garage_zip":""}},"driver_profile":{{"primary_driver_name":"","license_no":"","license_date":"","license_status":"","age_group":"","driving_record":"","relationship":""}},"coverage_limits_and_deductibles":[],"discounts_applied":{{"good_driver":"","multi_policy":"","vehicle_safety":"","federal_employee":"","total_savings":""}},"billing_information":{{"payment_method":"","payment_plan":"","monthly_amount":"","next_due_date":"","bank_account":""}}}}"""
        
        return prompt
    
    def fast_ollama_call(self, prompt):
        """Optimized Ollama API call for speed"""
        url = "http://127.0.0.1:11434/api/generate"
        payload = {
            "model": "llama3.2:3b",
            "prompt": prompt,
            "stream": False,
            "options": {
                "temperature": 0.01,  # Very low for fast, deterministic responses
                "top_p": 0.5,        # Reduce choices for speed
                "num_predict": 800,   # Reduce output length
                "num_ctx": 1024,     # Small context window
                "num_batch": 1024,   # Large batch for GPU efficiency
                "num_gpu": 99,       # Use all GPU layers
                "num_thread": 1,     # Minimize CPU threads
                "repeat_penalty": 1.0,  # No penalty for speed
                "stop": ["}}", "\\n\\n", "END"]  # Stop tokens for faster completion
            }
        }
        
        headers = {"Content-Type": "application/json"}
        resp = requests.post(url, data=json.dumps(payload), headers=headers, timeout=60)
        resp.raise_for_status()
        
        response_data = resp.json()
        content = response_data.get('response', '')
        
        return content
    
    def parse_json_response(self, content):
        """Fast JSON parsing with error handling"""
        content = content.strip()
        
        # Find JSON boundaries
        if '{' in content and '}' in content:
            start = content.find('{')
            end = content.rfind('}') + 1
            content = content[start:end]
        
        try:
            return json.loads(content)
        except json.JSONDecodeError:
            # Fallback: create minimal structure
            return {
                "policy_number": "",
                "effective_dates": {"start": "", "end": ""},
                "policyholder_details": {"full_name": "", "address": "", "city_state_zip": "", "phone": "", "email": "", "dob": "", "gender": "", "marital_status": ""},
                "policy_information": {"policy_type": "", "issue_date": "", "term_length": "", "renewal_date": "", "agent": "", "agent_id": "", "office_phone": ""},
                "insured_vehicle": {"year": "", "make": "", "model": "", "vin": "", "license_plate": "", "body_type": "", "usage_class": "", "mileage": "", "garage_zip": ""},
                "driver_profile": {"primary_driver_name": "", "license_no": "", "license_date": "", "license_status": "", "age_group": "", "driving_record": "", "relationship": ""},
                "coverage_limits_and_deductibles": [],
                "discounts_applied": {"good_driver": "", "multi_policy": "", "vehicle_safety": "", "federal_employee": "", "total_savings": ""},
                "billing_information": {"payment_method": "", "payment_plan": "", "monthly_amount": "", "next_due_date": "", "bank_account": ""}
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
    
    # Handle image processing
    if len(sys.argv) > 1 and not sys.argv[1].startswith("--"):
        image_path = sys.argv[1]
    else:
        print("[ERROR] No image path provided", file=sys.stderr)
        sys.exit(1)
    
    try:
        extractor = FastInsuranceExtractor()
        result = extractor.process_document(image_path)
        print(json.dumps(result, ensure_ascii=False, indent=2))
    except Exception as e:
        print(f"[ERROR] Processing failed: {e}", file=sys.stderr)
        sys.exit(1)