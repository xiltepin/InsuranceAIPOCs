# Issue-5: OCR NumPy ABI Version Conflict and Upload Failure

## Status
- **Current Status**: Open / Investigating

## Description
When attempting to upload `docs/sample_insurance_policy.pdf` via the OCRAuto interface at `https://poc.xiltepin.me/OCRAuto`, the system throws errors both on the backend and frontend.

### Backend Error Details
The Python OCR script fails to execute because it was compiled against an older ABI version of NumPy, but is encountering NumPy 2.x during runtime.
```text
Failed to process image: OCR execution failed with code 1: 
[SUCCESS] PyMuPDF imported - PDF support enabled 
RuntimeError: module compiled against ABI version 0x1000009 but this version of numpy is 0x2000000 
RuntimeError: module compiled against ABI version 0x1000009 but this version of numpy is 0x2000000 
[ERROR] Failed to import PaddleOCR: numpy.core.multiarray failed to import .
```

### Frontend (Browser) Error Details
Due to the backend crash, the Angular service receives an HTTP 400 response from the `/api/upload-image` endpoint.
```text
ANGULAR SERVICE: HTTP Error uploading image: 
Object { headers: {…}, status: 400, statusText: "OK", url: "https://poc.xiltepin.me/api/upload-image", ok: false, type: undefined, redirected: undefined, name: "HttpErrorResponse", message: "Http failure response for https://poc.xiltepin.me/api/upload-image: 400 OK", error: {…} }
main-VDYAGYGT.js:5:132149
ANGULAR SERVICE: Error status: 400 main-VDYAGYGT.js:5:132213
ANGULAR SERVICE: Error message: Http failure response for https://poc.xiltepin.me/api/upload-image: 400 OK.
```

## Findings
- **PaddleOCR vs NumPy Dependency**: The version of `paddlepaddle` / `paddleocr` being used is incompatible with NumPy >= 2.0.0. The backend Python environment needs to ensure it forces a NumPy version `< 2.0`.
- The frontend is correctly capturing and logging the 400 Bad Request error returned by the NestJS backend as a result of the PaddleOCR script failure.

## Resolution Steps
1. Verify the `backend/Dockerfile` or `requirements.txt` correctly pins `numpy<2.0`.
2. Rebuild the backend container image to ensure the correct numpy version is installed and cached properly.
3. Fix any underlying script execution errors.
4. Once completed, a human must verify the unit testing completion before this issue can be flagged as completed.

## Verification
- [ ] Unit testing finalized
- [ ] Human verification confirmed
