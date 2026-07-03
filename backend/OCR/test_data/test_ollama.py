import requests
import json
import time

url = 'http://192.168.0.6:11434/api/chat'
model = 'gemma4:12b'

ocr_text = """AUTO INSURANCE POLICY DECLARATION
Policy Information
Policy Number: POL-987654321
Effective Start: 2026-07-01
Effective End: 2027-07-01
Policy Type: Auto
Issue Date: 2026-06-15
Term Length: 12 Months
Renewal Date: 2027-07-01
Policyholder Details
Full Name: John Doe
Address: 123 Main St
City State Zip: Springfield, IL 62701
Phone: 555-123-4567
Email: john.doe@example.com
Driver Profile
DOB: 1980-05-15
Gender: M
Marital Status: Married
License Number: S1234567
Driving Record: Clean (0 violations)
Insured Vehicle
Vehicle: 2020 Toyota Camry
VIN: 1YV03948572039485
License Plate: XYZ-1234
Body Type: Sedan
Usage Class: Commute
Annual Mileage: 12000
Garaging Zip: 62701
Coverage Limits & Deductibles
Bodily Injury Liability: $100,000 / $300,000
Property Damage Liability: $50,000
Personal Injury Protection: $10,000
Uninsured Motorist (BI): $100,000 / $300,000
Uninsured Motorist (PD): $50,000
Collision: Actual Cash Value (Ded: $500)
Comprehensive: Actual Cash Value (Ded: $500)
Emergency Roadside Service: Included
Discounts Applied
Safe Driver Discount: -$50.00
Multi-Policy Discount: -$25.00
Pay-in-Full Discount: -$15.00
Billing Information
Total Premium: $850.00
Payment Method: Credit Card ending in 1234
Payment Status: Paid in Full
Agent: Jane Smith
Agent ID: AGT-456
Office Phone: 555-987-6543"""

prompt = f"""Extract data from the OCR text below into the matching JSON structure.
Keep your thinking/reasoning process extremely brief (less than 2 sentences total).

OCR Text:
{ocr_text}

Return only a valid JSON object matching this structure:
{{"policy_number":"","effective_dates":{{"start":"","end":""}},"policyholder_details":{{"full_name":"","address":"","city_state_zip":"","phone":"","email":"","dob":"","gender":"","marital_status":""}},"policy_information":{{"policy_type":"","issue_date":"","term_length":"","renewal_date":"","agent":"","agent_id":"","office_phone":""}},"insured_vehicle":{{"year":"","make":"","model":"","vin":"","license_plate":"","body_type":"","usage_class":"","mileage":"","garage_zip":""}},"driver_profile":{{"primary_driver":"","license_no":"","license_date":"","license_status":"","age_group":"","driving_record":"","relationship":""}},"billing":{{"payment_method":"","payment_plan":"","monthly_amount":"","next_due_date":"","bank_account":"","total_premium":"","payment_status":""}},"discounts":{{"good_driver":"","multi_policy":"","vehicle_safety":"","defensive_driving":"","federal_employee":"","total_savings":""}},"coverage_limits":[]}}

Match patterns exactly as they appear in the OCR text. Wrap the JSON response in a markdown code block using ```json and ```."""

payload = {
    "model": model,
    "messages": [
        {
            "role": "system",
            "content": "You are a precise data extraction assistant. You extract structured JSON from OCR text based on user instructions."
        },
        {
            "role": "user",
            "content": prompt
        }
    ],
    "stream": True,
    "options": {
        "temperature": 0.0,
        "num_predict": 4096,
        "num_ctx": 8192,
        "top_p": 0.0,
        "top_k": 1
    }
}

print("Calling Ollama (streaming chat)...")
start_time = time.time()
resp = requests.post(url, data=json.dumps(payload), headers={"Content-Type": "application/json"}, stream=True)
print("Status:", resp.status_code)
print("Streaming response:")
for line in resp.iter_lines():
    if line:
        chunk = json.loads(line.decode('utf-8'))
        message = chunk.get("message", {})
        response_text = message.get("content", "")
        if response_text:
            print(response_text, end="", flush=True)
total_time = time.time() - start_time
print(f"\nStream finished in {total_time:.2f}s.")
