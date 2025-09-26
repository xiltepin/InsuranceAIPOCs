# Insurance OCR Web Application

A comprehensive web application for extracting text from insurance documents using OCR (Optical Character Recognition) technology with multiple processing approaches.

## 🏗️ Project Structure

```
PCO/
├── frontend/           # Angular web application
├── backend/            # NestJS API server  
└── OCR/               # OCR processing services
    ├── raw_data/      # Uploaded images and raw OCR output
    ├── Results/       # Processed JSON results
    ├── extract_to_json.py      # Advanced OCR with AI parsing (EasyOCR + Ollama)
    ├── ocr_service.py          # Basic OCR service (PaddleOCR)
    ├── Test-Geico.jpg          # Sample US insurance document
    ├── SamplePolicy.pdf        # Sample Japanese insurance document
    └── SamplePolicy.jpeg       # Sample Japanese insurance document
```

## 🎯 What This Project Does

This application provides two OCR processing approaches:

### 1. Web-based OCR (PaddleOCR)
- Upload images through a modern Angular web interface
- Process documents using PaddleOCR via NestJS backend
- Real-time results with confidence scores
- Text block visualization with bounding boxes

### 2. Advanced OCR with AI (EasyOCR + Ollama)
- Command-line tool for detailed insurance document parsing
- Uses EasyOCR for text extraction
- Employs Ollama LLM for intelligent data structuring
- Outputs structured JSON with insurance-specific fields
- Supports both English and Japanese documents

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+ and npm
- **Python** 3.10+ (tested with 3.12/3.13)
- **Git** for version control

### Option 1: Web Application Setup

1. **Clone the repository:**
   ```bash
   git clone <your-repo-url>
   cd PCO
   ```

2. **Install Python dependencies:**
   ```bash
   cd OCR
   pip install paddleocr flask flask-cors pillow opencv-python
   ```

3. **Setup NestJS backend:**
   ```bash
   cd ../backend
   npm install
   npm install @nestjs/platform-express multer
   npm install -D @types/multer
   ```

4. **Setup Angular frontend:**
   ```bash
   cd ../frontend
   npm install
   ```

5. **Start all services:**
   ```bash
   # Terminal 1: Start backend
   cd backend
   npm run start:dev

   # Terminal 2: Start frontend
   cd frontend
   ng serve
   ```

6. **Open web application:**
   - Navigate to `http://localhost:4200`
   - Upload an image and click "Process OCR"

### Option 2: Advanced OCR CLI Setup

1. **Install additional dependencies:**
   ```bash
   cd OCR
   pip install easyocr==1.7.2 ollama==0.5.4 numpy Pillow
   ```

2. **Install and setup Ollama:**
   ```bash
   # Download from: https://ollama.com/download
   # After installation:
   ollama pull llama3.1:8b
   ollama pull phi3:3.8b
   ```

3. **Run OCR processing:**
   ```bash
   # Process with summary
   python extract_to_json.py Test-Geico --summary
   
   # Basic processing
   python extract_to_json.py SamplePolicy
   ```

## 📋 Features

### Web Application Features
- **Modern UI**: Professional Angular interface with responsive design
- **File Validation**: Checks file type and size before processing
- **Real-time Processing**: Live feedback during OCR processing
- **Confidence Scoring**: Shows extraction confidence levels
- **Text Block Visualization**: Displays individual text blocks with positions
- **Error Handling**: User-friendly error messages and recovery

### Advanced OCR Features
- **Multi-language Support**: English and Japanese document processing
- **AI-powered Parsing**: Uses LLM to structure extracted data
- **Insurance-specific Fields**: Extracts policy numbers, coverage details, etc.
- **Confidence Assessment**: Provides accuracy metrics for extracted data
- **Multiple Output Formats**: Raw text files and structured JSON
- **Batch Processing**: Can process multiple documents

### Supported Data Fields
- Policy holder information (name, address, contact details)
- Policy information (number, dates, type, company)
- Vehicle information (make, model, VIN, license plate)
- Coverage details (liability limits, deductibles, premiums)
- Billing information (payment method, amounts, due dates)
- Driver profile information

## 🔧 Configuration

### Web Application Configuration

**Backend (NestJS) - `backend/src/main.ts`:**
```typescript
// CORS configuration
app.enableCors({
  origin: 'http://localhost:4200',
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  credentials: true,
});
```

**File Upload Limits - `backend/src/app.controller.ts`:**
```typescript
limits: {
  fileSize: 10 * 1024 * 1024, // 10MB limit
}
```

### Advanced OCR Configuration

**Model Selection in `extract_to_json.py`:**
```python
# Change LLM model
model='llama3.1:8b'     # Default - balanced performance
model='phi3:3.8b'       # Faster, lighter model  
model='llama3.2:latest' # Latest features
```

**Language Support:**
```python
# OCR languages
languages=['en', 'ja']  # English and Japanese
languages=['en']        # English only
```

## 📊 Usage Examples

### Web Interface Usage
1. Open `http://localhost:4200`
2. Click "Choose Image" and select an insurance document
3. Click "Process OCR" to extract text
4. View results with confidence scores and text blocks

### Command Line Usage
```bash
# Process GEICO sample document
python extract_to_json.py Test-Geico --summary

# Process Japanese insurance document  
python extract_to_json.py SamplePolicy --summary

# Process custom document
python extract_to_json.py my-policy.jpg
```

### Expected Output Structure
```json
{
  "document_metadata": {
    "filename": "Test-Geico.jpg",
    "extraction_timestamp": "2024-09-26 10:30:15 JST",
    "document_type": "auto_insurance_policy"
  },
  "policy_holder": {
    "full_name": {"value": "Sarah Chen Williams", "confidence": "high"},
    "address": {
      "street": {"value": "892 Maple Avenue", "confidence": "medium"},
      "city": {"value": "Austin", "confidence": "high"},
      "state": {"value": "TX", "confidence": "high"}
    }
  },
  "policy_information": {
    "policy_number": {"value": "GC456789012", "confidence": "high"},
    "insurance_company": {"value": "GEICO", "confidence": "high"}
  }
}
```

## 🛠️ Troubleshooting

### Common Issues

**Backend Connection Failed:**
```bash
# Check if backend is running
curl http://localhost:3000
# Should return: "OCR Backend Server is running!"
```

**CORS Errors:**
- Ensure backend CORS is configured for `http://localhost:4200`
- Check that both frontend and backend are running on correct ports

**OCR Processing Errors:**
```bash
# Test PaddleOCR installation
python -c "from paddleocr import PaddleOCR; print('PaddleOCR working')"

# Test EasyOCR installation  
python -c "import easyocr; print('EasyOCR working')"
```

**Ollama Connection Issues:**
```bash
# Check Ollama service
ollama list
ollama serve  # If not running
```

### Performance Tips

**For Better Speed:**
- Use GPU-enabled environment for OCR processing
- Use lighter LLM models (phi3:3.8b instead of llama3.1:8b)
- Process smaller/compressed images when possible

**For Better Accuracy:**
- Use high-resolution, well-lit images
- Ensure documents are properly aligned
- Use larger LLM models for complex documents
- Pre-process images to improve contrast if needed

## 📁 File Descriptions

### Core Files
- **`extract_to_json.py`**: Advanced OCR with AI parsing using EasyOCR + Ollama
- **`ocr_service.py`**: Basic OCR service for web application using PaddleOCR
- **`frontend/src/app/app.ts`**: Main Angular component with upload interface
- **`backend/src/app.controller.ts`**: NestJS API endpoints for file upload and OCR

### Sample Documents
- **`Test-Geico.jpg`**: US GEICO insurance declaration page (English)
- **`SamplePolicy.pdf/jpeg`**: Japanese auto insurance policy document

### Output Directories
- **`raw_data/`**: Stores uploaded images and raw OCR text output
- **`Results/JSON/`**: Contains structured JSON extraction results

## 🔒 Security Considerations

- File uploads are validated for type and size
- Files are stored temporarily in designated directories
- No sensitive data is logged in plain text
- CORS is configured to allow only specific origins

## 🚀 Deployment Notes

### For Production:
1. Configure environment variables for API endpoints
2. Set up proper file storage (cloud storage vs local)
3. Implement authentication and rate limiting
4. Configure reverse proxy for API routing
5. Set up SSL certificates for HTTPS

### Docker Deployment:
- Consider containerizing each service (frontend, backend, OCR)
- Use Docker Compose for orchestration
- Mount volumes for persistent data storage

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes and test thoroughly
4. Commit changes: `git commit -m "Description of changes"`
5. Push to branch: `git push origin feature-name`
6. Submit a pull request

## 📜 License

This project is for educational and demonstration purposes. Ensure compliance with OCR library licenses and LLM model terms of use.

## 🆘 Support

For issues and questions:
1. Check the troubleshooting section above
2. Verify all dependencies are properly installed
3. Test individual components (OCR libraries, web servers)
4. Review console logs for specific error messages

---

**Note**: This application processes insurance documents which may contain sensitive personal information. Ensure proper data handling practices and compliance with relevant privacy regulations in your jurisdiction.