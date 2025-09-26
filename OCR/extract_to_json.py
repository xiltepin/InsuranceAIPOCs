import easyocr
import json
import numpy as np
from PIL import Image
import ollama
import re
import sys
import os
from datetime import datetime

# Set Ollama host to localhost
os.environ['OLLAMA_HOST'] = 'http://127.0.0.1:11434'

class InsuranceDocumentExtractor:
    def __init__(self, languages=['ja', 'en'], use_gpu=True):
        # Try GPU first, fallback to CPU if GPU fails
        try:
            self.reader = easyocr.Reader(languages, gpu=use_gpu)
            print(f"EasyOCR initialized with GPU: {use_gpu}")
        except Exception as e:
            print(f"GPU initialization failed: {e}")
            print("Falling back to CPU...")
            self.reader = easyocr.Reader(languages, gpu=False)
        self.confidence_scores = {}
    
    def extract_text(self, image_path):
        """Extract text with confidence scores"""
        image = Image.open(image_path)
        img_np = np.array(image)
        
        # Get detailed results with confidence scores
        detailed_result = self.reader.readtext(img_np, detail=1)
        
        # Extract text and calculate average confidence
        text_blocks = []
        total_confidence = 0
        
        for (bbox, text, confidence) in detailed_result:
            text_blocks.append(text)
            total_confidence += confidence
        
        raw_text = "\n".join(text_blocks).strip()
        avg_confidence = total_confidence / len(detailed_result) if detailed_result else 0
        
        self.confidence_scores['ocr_confidence'] = avg_confidence
        
        return raw_text, detailed_result
    
    def create_enhanced_prompt(self, raw_text, image_path):
        """Create enhanced prompt for better Llama 3.1 parsing"""
        current_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S JST")
        
        prompt = f"""
You are an expert insurance document parser. Extract information from OCR text and return ONLY valid JSON.

CRITICAL: Your response must be ONLY the JSON structure below. No explanations, no markdown, no extra text.

Parse this OCR text from an auto insurance document:
{raw_text}

Return this exact JSON structure with extracted values:

{{
  "document_metadata": {{
    "filename": "{image_path}",
    "extraction_timestamp": "{current_time}",
    "document_language": "english",
    "document_type": "auto_insurance_policy"
  }},
  "confidence_assessment": {{
    "overall_confidence": "medium",
    "field_confidence": {{
      "policy_holder": "medium",
      "policy_info": "medium",
      "vehicle": "medium",
      "coverage": "medium",
      "billing": "medium"
    }}
  }},
  "policy_holder": {{
    "full_name": {{"value": "extract from text or empty", "confidence": "high"}},
    "address": {{
      "street": {{"value": "extract from text or empty", "confidence": "medium"}},
      "city": {{"value": "extract from text or empty", "confidence": "medium"}},
      "state": {{"value": "extract from text or empty", "confidence": "medium"}},
      "zip_code": {{"value": "extract from text or empty", "confidence": "medium"}}
    }},
    "phone": {{"value": "extract from text or empty", "confidence": "medium"}},
    "email": {{"value": "extract from text or empty", "confidence": "medium"}},
    "date_of_birth": {{"value": "extract from text or empty", "confidence": "medium"}},
    "gender": {{"value": "extract from text or empty", "confidence": "medium"}},
    "marital_status": {{"value": "extract from text or empty", "confidence": "medium"}}
  }},
  "policy_information": {{
    "policy_number": {{"value": "extract from text or empty", "confidence": "high"}},
    "effective_date": {{"value": "extract from text or empty", "confidence": "high"}},
    "expiration_date": {{"value": "extract from text or empty", "confidence": "high"}},
    "policy_term": {{"value": "extract from text or empty", "confidence": "medium"}},
    "policy_type": {{"value": "extract from text or empty", "confidence": "medium"}},
    "issue_date": {{"value": "extract from text or empty", "confidence": "medium"}},
    "renewal_date": {{"value": "extract from text or empty", "confidence": "medium"}},
    "agent_name": {{"value": "extract from text or empty", "confidence": "medium"}},
    "agent_id": {{"value": "extract from text or empty", "confidence": "medium"}},
    "insurance_company": {{"value": "extract from text or empty", "confidence": "high"}}
  }},
  "vehicle_information": {{
    "year_make_model": {{"value": "extract from text or empty", "confidence": "medium"}},
    "vin": {{"value": "extract from text or empty", "confidence": "medium"}},
    "license_plate": {{"value": "extract from text or empty", "confidence": "medium"}},
    "body_type": {{"value": "extract from text or empty", "confidence": "medium"}},
    "usage_class": {{"value": "extract from text or empty", "confidence": "medium"}},
    "annual_mileage": {{"value": "extract from text or empty", "confidence": "medium"}},
    "garaging_zip": {{"value": "extract from text or empty", "confidence": "medium"}}
  }},
  "coverage_details": {{
    "bodily_injury_liability": {{
      "limit": {{"value": "extract from text or empty", "confidence": "medium"}},
      "premium": {{"value": "extract from text or empty", "confidence": "medium"}}
    }},
    "property_damage_liability": {{
      "limit": {{"value": "extract from text or empty", "confidence": "medium"}},
      "premium": {{"value": "extract from text or empty", "confidence": "medium"}}
    }},
    "collision": {{
      "deductible": {{"value": "extract from text or empty", "confidence": "medium"}},
      "premium": {{"value": "extract from text or empty", "confidence": "medium"}}
    }},
    "comprehensive": {{
      "deductible": {{"value": "extract from text or empty", "confidence": "medium"}},
      "premium": {{"value": "extract from text or empty", "confidence": "medium"}}
    }}
  }},
  "billing_information": {{
    "payment_method": {{"value": "extract from text or empty", "confidence": "medium"}},
    "payment_plan": {{"value": "extract from text or empty", "confidence": "medium"}},
    "monthly_payment": {{"value": "extract from text or empty", "confidence": "medium"}},
    "total_premium": {{"value": "extract from text or empty", "confidence": "medium"}},
    "next_due_date": {{"value": "extract from text or empty", "confidence": "medium"}},
    "discounts_applied": {{
      "total_discounts": {{"value": "extract from text or empty", "confidence": "medium"}}
    }}
  }}
}}

IMPORTANT: Return ONLY this JSON structure. No other text.
"""
        return prompt
    
    def parse_with_ollama(self, raw_text, image_path):
        """Enhanced parsing with better error handling and debugging"""
        prompt = self.create_enhanced_prompt(raw_text, image_path)
        
        try:
            print("Sending request to Ollama...")
            response = ollama.chat(
                model='phi3:3.8b',
                messages=[{"role": "user", "content": prompt}],
                options={
                    "temperature": 0.1,
                    "top_p": 0.9,
                    "num_predict": 4000
                }
            )
            
            content = response['message']['content']
            print(f"Raw Ollama response length: {len(content)}")
            print(f"First 200 chars: {content[:200]}...")
            
            # More aggressive content cleaning
            content = content.strip()
            
            # Remove markdown formatting
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
            
            # Find JSON-like content between braces
            if '{' in content and '}' in content:
                start = content.find('{')
                end = content.rfind('}') + 1
                content = content[start:end]
            
            print(f"Cleaned content length: {len(content)}")
            print(f"Cleaned first 100 chars: {content[:100]}...")
            
            # Try to parse JSON
            parsed_json = json.loads(content)
            print("✅ JSON parsed successfully!")
            return parsed_json
            
        except json.JSONDecodeError as e:
            print(f"❌ JSON parsing error: {e}")
            print(f"Problematic content (first 300 chars): {content[:300]}")
            
            # Try to fix common JSON issues
            try:
                # Replace single quotes with double quotes
                content_fixed = content.replace("'", '"')
                parsed_json = json.loads(content_fixed)
                print("✅ Fixed JSON by replacing single quotes!")
                return parsed_json
            except:
                print("❌ Could not fix JSON, using fallback structure")
                return self._create_fallback_structure(image_path)
                
        except Exception as e:
            print(f"❌ Ollama parsing error: {e}")
            return self._create_fallback_structure(image_path)
    
    def _create_fallback_structure(self, image_path):
        """Create fallback JSON structure when parsing fails"""
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
        """Calculate confidence metrics"""
        confidence_scores = {
            "ocr_confidence": self.confidence_scores.get('ocr_confidence', 0),
            "extraction_completeness": 0,
            "field_accuracy_estimates": {}
        }
        
        # Calculate completeness score
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
                                # Record field confidence
                                field_name = f"{prefix}.{key}" if prefix else key
                                confidence_scores["field_accuracy_estimates"][field_name] = value["confidence"]
                        else:
                            count_fields(value, f"{prefix}.{key}" if prefix else key)
        
        count_fields(extracted_data)
        
        confidence_scores["extraction_completeness"] = (filled_fields / total_fields * 100) if total_fields > 0 else 0
        
        return confidence_scores
    
    def process_document(self, image_path):
        """Main processing function"""
        print(f"Processing: {image_path}")
        
        # Check if file exists
        if not os.path.exists(image_path):
            raise FileNotFoundError(f"Image file not found: {image_path}")
        
        # Create directories if they don't exist
        raw_data_dir = "raw_data"
        results_dir = os.path.join("Results", "JSON")
        os.makedirs(raw_data_dir, exist_ok=True)
        os.makedirs(results_dir, exist_ok=True)
        
        # Generate timestamp for filenames
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        
        # Extract text
        raw_text, detailed_ocr = self.extract_text(image_path)
        print(f"OCR Confidence: {self.confidence_scores['ocr_confidence']:.2f}")
        print("Raw OCR Text:", raw_text[:500] + "..." if len(raw_text) > 500 else raw_text)
        
        # Save raw data to .txt file
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
        
        print(f"Raw data saved to: {raw_filename}")
        
        # Parse with Ollama
        extracted_data = self.parse_with_ollama(raw_text, image_path)
        
        # Calculate accuracy metrics
        accuracy_metrics = self.calculate_extraction_accuracy(extracted_data)
        extracted_data["accuracy_metrics"] = accuracy_metrics
        
        # Save JSON results
        json_filename = os.path.join(results_dir, f"insurance_data_{timestamp}.json")
        with open(json_filename, "w", encoding="utf-8") as json_file:
            json.dump(extracted_data, json_file, ensure_ascii=False, indent=2)
        
        print(f"JSON file saved to: {json_filename}")
        print(f"Overall accuracy metrics:")
        print(f"  - OCR Confidence: {accuracy_metrics['ocr_confidence']:.1%}")
        print(f"  - Extraction Completeness: {accuracy_metrics['extraction_completeness']:.1f}%")
        
        return extracted_data, accuracy_metrics

def process_insurance_document(image_path, languages=['ja', 'en']):
    """Standalone function for API integration"""
    extractor = InsuranceDocumentExtractor(languages=languages)
    return extractor.process_document(image_path)

# Command line interface
if __name__ == "__main__":
    # Get image path from command line argument or use default
    if len(sys.argv) > 1:
        image_path = sys.argv[1]
    else:
        image_path = "Test-Geico.jpg"  # Default fallback
    
    # Add file extension if not provided
    if not image_path.lower().endswith(('.jpg', '.jpeg', '.png')):
        image_path += ".jpg"
    
    print(f"Processing image: {image_path}")
    
    try:
        # Process document using the standalone function
        data, metrics = process_insurance_document(image_path)
        print("\n✅ Processing completed successfully!")
        
        # Optional: print summary
        if "--summary" in sys.argv:
            print("\n📋 EXTRACTION SUMMARY:")
            policy_num = data.get('policy_information', {}).get('policy_number', {}).get('value', 'Not found')
            policy_holder = data.get('policy_holder', {}).get('full_name', {}).get('value', 'Not found')
            insurance_co = data.get('policy_information', {}).get('insurance_company', {}).get('value', 'Not found')
            
            print(f"Policy Number: {policy_num}")
            print(f"Policy Holder: {policy_holder}")
            print(f"Insurance Company: {insurance_co}")
        
    except FileNotFoundError:
        print(f"❌ Error: File '{image_path}' not found!")
        print("Make sure the image file is in the same directory as this script.")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Error processing document: {e}")
        sys.exit(1)