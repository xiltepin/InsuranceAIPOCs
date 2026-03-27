import sys
import json
from paddleocr import PaddleOCR

def process_image(image_path):
    # Initialize PaddleOCR (example)
    ocr = PaddleOCR(use_angle_cls=True, lang='en')
    
    # Check file extension
    if not image_path.lower().endswith(('.jpg', '.png', '.jpeg', '.bmp', '.pdf')):
        print(f"Not supported input file type! Only PDF and image files ended with suffix `jpg, png, jpeg, bmp, pdf` are supported! But received `{image_path}`.", file=sys.stderr)
        return {"status": "error", "message": "Unsupported file type"}

    # Perform OCR
    result = ocr.ocr(image_path, cls=True)
    text_blocks = [line[1][0] for line in result if result]  # Extract text blocks
    full_text = ' '.join(text_blocks) if text_blocks else ""

    # Output only JSON
    output = {
        "status": "success",
        "image_path": image_path,
        "text_blocks": text_blocks,
        "full_text": full_text
    }
    print(json.dumps(output))  # Print JSON directly

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print(json.dumps({"status": "error", "message": "Invalid arguments"}), file=sys.stderr)
        sys.exit(1)
    process_image(sys.argv[1])