import requests
import json

url = 'http://192.168.0.6:11434/api/generate'
model = 'gemma4:12b'

prompt = """Extract data from this insurance document text and return JSON:

AUTO INSURANCE POLICY DECLARATION
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
Office Phone: 555-987-6543

Extract these fields into nested JSON structure:

POLICY LEVEL:
- policy_number: Text immediately after "Policy Number:" or alphanumeric code starting with letters

EFFECTIVE DATES:
- start: Date after "Effective Date:", "Effective Start:", "Effective:" (format: Month Day, Year or YYYY-MM-DD)
- end: Date after "Expiration:", "Effective End:", "Expiration Date:" or second date after effective

POLICYHOLDER DETAILS:
- full_name: Text after "Full Name:", "Name:", or under "NAMED INSURED" / "Policyholder Details" section
- address: Text after "Address:" label
- city_state_zip: Text after "City State Zip:", "City/State/ZIP:", "City/State:", or combine city and state info
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
- office_phone: Phone number after "Agent Phone:", "Office Phone:" or "Office Phone:" label

INSURED VEHICLE:
- year: 4-digit year from "Vehicle:" or "Year/Make/Model:" description
- make: Brand name (e.g. Toyota) from "Vehicle:" description  
- model: Model name (e.g. Camry) from "Vehicle:" description
- vin: Alphanumeric code after "VIN:" or "VIN Number:"
- license_plate: Plate number after "License Plate:" label
- body_type: Vehicle type after "Body Type:" label (if available)
- usage_class: Text after "Usage:" or "Usage Class:" label
- mileage: Number + "miles" after "Annual Mileage:" or "Annual Mileage" label
- garage_zip: ZIP code from garaging location / "Garaging Zip:" or address

DRIVER PROFILE:
- primary_driver: Full name under "Driver Profile" or primary driver
- license_no: License Number
- license_date: License Issue Date (if available)
- license_status: License Status (e.g. Active, Clean)
- age_group: Age group description or age
- driving_record: Driving record info (e.g. violations)
- relationship: Relationship to policyholder (e.g. Self, Spouse)

BILLING:
- payment_method: Payment method/source description (e.g., Credit Card ending in 1234)
- payment_plan: Payment plan / payment frequency (e.g., Paid in Full)
- monthly_amount: Monthly premium payment amount (if any)
- next_due_date: Next payment due date (if any)
- bank_account: Bank account / card info (if any)
- total_premium: Total Premium amount (e.g. $850.00)
- payment_status: Payment Status (e.g. Paid in Full)

DISCOUNTS:
- good_driver: Safe Driver Discount or Good Driver discount value (e.g. -$50.00)
- multi_policy: Multi-Policy discount value (e.g. -$25.00)
- vehicle_safety: Vehicle Safety discount value (if any)
- defensive_driving: Defensive driving discount value (if any)
- federal_employee: Federal employee discount value (if any)
- total_savings: Sum/total value of all discounts combined (e.g. -$90.00)

COVERAGE LIMITS:
- coverage_limits: Array of objects, each containing:
  - type: Coverage type name (e.g., Bodily Injury Liability, Property Damage Liability, Personal Injury Protection, Uninsured Motorist (BI), Uninsured Motorist (PD), Collision, Comprehensive, Emergency Roadside Service)
  - limit: Coverage limit amount (e.g. $100,000 / $300,000)
  - deductible: Deductible amount if any (e.g. $500)
  - premium: Premium amount for this coverage if any

Return JSON with this EXACT structure:
{"policy_number":"","effective_dates":{"start":"","end":""},"policyholder_details":{"full_name":"","address":"","city_state_zip":"","phone":"","email":"","dob":"","gender":"","marital_status":""},"policy_information":{"policy_type":"","issue_date":"","term_length":"","renewal_date":"","agent":"","agent_id":"","office_phone":""},"insured_vehicle":{"year":"","make":"","model":"","vin":"","license_plate":"","body_type":"","usage_class":"","mileage":"","garage_zip":""},"driver_profile":{"primary_driver":"","license_no":"","license_date":"","license_status":"","age_group":"","driving_record":"","relationship":""},"billing":{"payment_method":"","payment_plan":"","monthly_amount":"","next_due_date":"","bank_account":"","total_premium":"","payment_status":""},"discounts":{"good_driver":"","multi_policy":"","vehicle_safety":"","defensive_driving":"","federal_employee":"","total_savings":""},"coverage_limits":[]}

Match patterns exactly as they appear after the labels. Return only JSON."""

payload = {
    "model": model,
    "prompt": prompt,
    "stream": False
}

print("Calling Ollama...")
resp = requests.post(url, data=json.dumps(payload), headers={"Content-Type": "application/json"})
print("Status:", resp.status_code)
print("Response keys:", resp.json().keys())
print("Response text length:", len(resp.json().get("response", "")))
print("Response content:")
print(resp.json().get("response", ""))
