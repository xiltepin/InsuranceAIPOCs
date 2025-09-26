import sys
import json
import os
from paddleocr import PaddleOCR
import traceback

def process_image(image_path):
    try:
        # Initialize PaddleOCR with textline orientation detection
        ocr = PaddleOCR(use_textline_orientation=True, lang='en')
        
        # Use predict method
        result = ocr.predict(image_path)
        print("Debug: result =", result)
        
        formatted_result = {
            "status": "success",
            "image_path": image_path,
            "text_blocks": []
        }
        
        if result and len(result) > 0:
            # Extract data from the first dictionary in result
            data = result[0]  # Single dictionary with all results
            rec_texts = data.get('rec_texts', [])
            rec_scores = data.get('rec_scores', [])
            rec_boxes = data.get('rec_boxes', [])
            
            # Ensure lengths match
            num_items = min(len(rec_texts), len(rec_scores), len(rec_boxes))
            for i in range(num_items):
                text_block = {
                    "text": rec_texts[i],
                    "confidence": rec_scores[i],
                    "bbox": rec_boxes[i].tolist()  # Convert NumPy array to list
                }
                formatted_result["text_blocks"].append(text_block)
        
        all_text = " ".join([block["text"] for block in formatted_result["text_blocks"] if block["text"]])
        formatted_result["full_text"] = all_text
        
        return formatted_result
        
    except Exception as e:
        return {
            "status": "error",
            "message": str(e),
            "traceback": traceback.format_exc()
        }

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print(json.dumps({"status": "error", "message": "Usage: python ocr_service.py <image_path>"}))
        sys.exit(1)
    
    image_path = sys.argv[1]
    
    if not os.path.exists(image_path):
        print(json.dumps({"status": "error", "message": f"Image file not found: {image_path}"}))
        sys.exit(1)
    
    result = process_image(image_path)
    print(json.dumps(result, ensure_ascii=False, indent=2))