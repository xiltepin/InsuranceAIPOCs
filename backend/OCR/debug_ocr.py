#!/usr/bin/env python3
"""
Debug script to understand PaddleOCR output format
"""
import sys
from paddleocr import PaddleOCR
import json

def debug_ocr_output(image_path):
    print(f"Debugging OCR output for: {image_path}")
    
    # Initialize PaddleOCR
    ocr = PaddleOCR(lang='en')
    
    # Get OCR results - try both old and new methods
    print("Trying ocr.ocr() method:")
    try:
        result_ocr = ocr.ocr(image_path)
        print(f"ocr.ocr() success: {type(result_ocr)}")
    except Exception as e:
        print(f"ocr.ocr() failed: {e}")
        result_ocr = None
    
    print("\nTrying ocr.predict() method:")
    try:
        result_predict = ocr.predict(image_path)
        print(f"ocr.predict() success: {type(result_predict)}")
        
        # Check predict result structure
        if isinstance(result_predict, dict):
            print(f"Predict result keys: {list(result_predict.keys())}")
            for key, value in result_predict.items():
                print(f"  {key}: {type(value)}")
                if key in ['rec_texts', 'texts', 'text']:
                    print(f"    Content: {value}")
        elif hasattr(result_predict, '__dict__'):
            print(f"Predict result attributes: {list(result_predict.__dict__.keys())}")
    except Exception as e:
        print(f"ocr.predict() failed: {e}")
        result_predict = None
    
    # Use whichever method worked
    result = result_predict if result_predict is not None else result_ocr
    
    print(f"Result type: {type(result)}")
    print(f"Result length: {len(result) if hasattr(result, '__len__') else 'N/A'}")
    
    if isinstance(result, list) and len(result) > 0:
        page_result = result[0]
        print(f"Page result type: {type(page_result)}")
        print(f"Page result dir: {[attr for attr in dir(page_result) if not attr.startswith('_')]}")
        
        # Check if it has text attribute or other content
        if hasattr(page_result, 'text'):
            print(f"Direct text attribute: {page_result.text}")
        
        # Check for other attributes that might contain actual OCR results
        for attr in ['rec_texts', 'texts', 'results', 'data']:
            if hasattr(page_result, attr):
                value = getattr(page_result, attr)
                print(f"{attr} attribute: {type(value)} = {value}")
        
        # Check JSON representation and access internal data
        if hasattr(page_result, 'json') and callable(page_result.json):
            try:
                json_data = page_result.json()
                print(f"JSON representation keys: {list(json_data.keys()) if isinstance(json_data, dict) else type(json_data)}")
                
                # Look for text data in JSON
                if isinstance(json_data, dict):
                    for key in ['rec_texts', 'texts', 'text', 'results']:
                        if key in json_data:
                            print(f"Found {key}: {json_data[key]}")
            except Exception as json_error:
                print(f"JSON conversion failed: {json_error}")
        
        # Try to access data as dictionary
        print(f"Trying to access as dict:")
        try:
            for key in ['rec_texts', 'dt_polys', 'rec_scores']:
                if key in page_result:
                    value = page_result[key]
                    print(f"  {key}: {type(value)} (length: {len(value) if hasattr(value, '__len__') else 'N/A'})")
                    if hasattr(value, '__iter__') and not isinstance(value, str):
                        print(f"    First few items: {list(value)[:3] if len(list(value)) > 3 else list(value)}")
        except Exception as dict_error:
            print(f"Dictionary access failed: {dict_error}")
        
        # Try to iterate
        print(f"Iterating over page result:")
        try:
            for i, item in enumerate(page_result):
                print(f"  Item {i}: {type(item)} = {repr(item)}")
                if i >= 5:  # Limit output
                    print(f"  ... and {len(page_result) - 6} more items")
                    break
        except Exception as iter_error:
            print(f"  Iteration failed: {iter_error}")
        
        # Check if it's traditional format
        if isinstance(page_result, list) and len(page_result) > 0:
            first_item = page_result[0]
            print(f"First item type: {type(first_item)}")
            if isinstance(first_item, (list, tuple)) and len(first_item) >= 2:
                print(f"Traditional format detected:")
                print(f"  bbox: {first_item[0]}")
                print(f"  text_info: {first_item[1]}")
                if len(first_item[1]) >= 2:
                    print(f"    text: {first_item[1][0]}")
                    print(f"    confidence: {first_item[1][1]}")

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python debug_ocr.py <image_path>")
        sys.exit(1)
    
    debug_ocr_output(sys.argv[1])