# Issue-5: OCR NumPy ABI Version Conflict and Upload Failure

## Status
- **Current Status**: Open / Investigating

## Description
When attempting to upload `docs/sample_insurance_policy.pdf` via the OCRAuto interface at `https://poc.xiltepin.me/OCRAuto`, the system throws errors both on the backend and frontend.

### Expected Outcome
Once the `docs/sample_insurance_policy.pdf` is successfully scanned without errors, the following fields must be populated automatically:
- Policyholder Details
- Policy Information
- Insured Vehicle
- Driver Profile
- Coverage Limits & Deductibles
- Discounts Applied
- Billing Information

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

##Latest Status
 3. Trigger a manual execution test run to verify the ABI fix
docker compose exec backend python3 OCR/paddleocr_to_json.py OCR/test_data/SamplePolicy.pdf
[+] Building 282.6s (15/15) FINISHED                                                                                
 => [internal] load local bake definitions                                                                     0.0s
 => => reading from stdin 590B                                                                                 0.0s
 => [internal] load build definition from Dockerfile                                                           0.0s
 => => transferring dockerfile: 873B                                                                           0.0s
 => [internal] load metadata for docker.io/library/node:20-slim                                                1.0s
 => [internal] load .dockerignore                                                                              0.0s
 => => transferring context: 2B                                                                                0.0s
 => CACHED [1/8] FROM docker.io/library/node:20-slim@sha256:2cf067cfed83d5ea958367df9f966191a942351a2df77d6f0  0.0s
 => => resolve docker.io/library/node:20-slim@sha256:2cf067cfed83d5ea958367df9f966191a942351a2df77d6f0193e162  0.0s
 => [internal] load build context                                                                              2.1s
 => => transferring context: 3.23MB                                                                            2.1s
 => [2/8] RUN apt-get update -y && apt-get install -y     openssl     python3     python3-pip     python3-de  57.7s
 => [3/8] RUN pip3 install --no-cache-dir --break-system-packages     "numpy<2.0"     paddlepaddle==2.6.2     99.1s 
 => [4/8] WORKDIR /app                                                                                         0.3s 
 => [5/8] COPY package*.json ./                                                                                0.8s 
 => [6/8] RUN npm ci                                                                                          15.1s 
 => [7/8] COPY . .                                                                                            11.4s 
 => [8/8] RUN npm run build                                                                                    4.1s 
 => exporting to image                                                                                        92.7s 
 => => exporting layers                                                                                       53.0s 
 => => exporting manifest sha256:073bcb5bf3f47022209dff14fae2d7a5f751fb919319bc5b4389418d398e15b8              0.0s 
 => => exporting config sha256:6683cdb92af6f744afa7c1b2fe51fa4b3222b36460ff688ef55361f150ead0d9                0.0s
 => => exporting attestation manifest sha256:3896445d516977de35ebe9db1b2543c9d2dc70831dd0046a78142d6415a2a1bb  0.1s
 => => exporting manifest list sha256:0f4de6f1124bdbcfa64136c07b98411b2fff1d8de6aff85124e543449f5919ab         0.0s
 => => naming to docker.io/library/insuranceaipocs-backend:latest                                              0.0s
 => => unpacking to docker.io/library/insuranceaipocs-backend:latest                                          39.5s
 => resolving provenance for metadata file                                                                     0.0s
[+] build 1/1
 ✔ Image insuranceaipocs-backend Built                                                                        282.6s
[+] up 4/4
 ✔ Container insurance_frontend      Running                                                                    0.0s
 ✔ Container insurance_rating_engine Running                                                                    0.0s
 ✔ Container insurance_postgres      Running                                                                    0.0s
 ✔ Container insurance_backend       Started                                                                    5.5s
[SUCCESS] PyMuPDF imported - PDF support enabled
[SUCCESS] PaddleOCR imported successfully
download https://paddleocr.bj.bcebos.com/PP-OCRv3/english/en_PP-OCRv3_det_infer.tar to /root/.paddleocr/whl/det/en/en_PP-OCRv3_det_infer/en_PP-OCRv3_det_infer.tar
100%|████████████████████████████████████████████████████████████████████████| 4.00M/4.00M [00:01<00:00, 2.78MiB/s]
download https://paddleocr.bj.bcebos.com/PP-OCRv4/english/en_PP-OCRv4_rec_infer.tar to /root/.paddleocr/whl/rec/en/en_PP-OCRv4_rec_infer/en_PP-OCRv4_rec_infer.tar
100%|█████████████████████████████████████████████████████████████████████████| 10.2M/10.2M [00:23<00:00, 437kiB/s]
download https://paddleocr.bj.bcebos.com/dygraph_v2.0/ch/ch_ppocr_mobile_v2.0_cls_infer.tar to /root/.paddleocr/whl/cls/ch_ppocr_mobile_v2.0_cls_infer/ch_ppocr_mobile_v2.0_cls_infer.tar
100%|████████████████████████████████████████████████████████████████████████| 2.19M/2.19M [00:00<00:00, 2.67MiB/s]
[2026/07/03 02:49:36] ppocr DEBUG: Namespace(help='==SUPPRESS==', use_gpu=False, use_xpu=False, use_npu=False, ir_optim=True, use_tensorrt=False, min_subgraph_size=15, precision='fp32', gpu_mem=500, gpu_id=0, image_dir=None, page_num=0, det_algorithm='DB', det_model_dir='/root/.paddleocr/whl/det/en/en_PP-OCRv3_det_infer', det_limit_side_len=960, det_limit_type='max', det_box_type='quad', det_db_thresh=0.3, det_db_box_thresh=0.6, det_db_unclip_ratio=1.5, max_batch_size=10, use_dilation=False, det_db_score_mode='fast', det_east_score_thresh=0.8, det_east_cover_thresh=0.1, det_east_nms_thresh=0.2, det_sast_score_thresh=0.5, det_sast_nms_thresh=0.2, det_pse_thresh=0, det_pse_box_thresh=0.85, det_pse_min_area=16, det_pse_scale=1, scales=[8, 16, 32], alpha=1.0, beta=1.0, fourier_degree=5, rec_algorithm='SVTR_LCNet', rec_model_dir='/root/.paddleocr/whl/rec/en/en_PP-OCRv4_rec_infer', rec_image_inverse=True, rec_image_shape='3, 48, 320', rec_batch_num=6, max_text_length=25, rec_char_dict_path='/usr/local/lib/python3.11/dist-packages/paddleocr/ppocr/utils/en_dict.txt', use_space_char=True, vis_font_path='./doc/fonts/simfang.ttf', drop_score=0.5, e2e_algorithm='PGNet', e2e_model_dir=None, e2e_limit_side_len=768, e2e_limit_type='max', e2e_pgnet_score_thresh=0.5, e2e_char_dict_path='./ppocr/utils/ic15_dict.txt', e2e_pgnet_valid_set='totaltext', e2e_pgnet_mode='fast', use_angle_cls=False, cls_model_dir='/root/.paddleocr/whl/cls/ch_ppocr_mobile_v2.0_cls_infer', cls_image_shape='3, 48, 192', label_list=['0', '180'], cls_batch_num=6, cls_thresh=0.9, enable_mkldnn=False, cpu_threads=10, use_pdserving=False, warmup=False, sr_model_dir=None, sr_image_shape='3, 32, 128', sr_batch_num=1, draw_img_save_dir='./inference_results', save_crop_res=False, crop_res_save_dir='./output', use_mp=False, total_process_num=1, process_id=0, benchmark=False, save_log_path='./log_output/', show_log=True, use_onnx=False, output='./output', table_max_len=488, table_algorithm='TableAttn', table_model_dir=None, merge_no_span_structure=True, table_char_dict_path=None, layout_model_dir=None, layout_dict_path=None, layout_score_threshold=0.5, layout_nms_threshold=0.5, kie_algorithm='LayoutXLM', ser_model_dir=None, re_model_dir=None, use_visual_backbone=True, ser_dict_path='../train_data/XFUND/class_list_xfun.txt', ocr_order_method=None, mode='structure', image_orientation=False, layout=True, table=True, ocr=True, recovery=False, use_pdf2docx_api=False, invert=False, binarize=False, alphacolor=(255, 255, 255), lang='en', det=True, rec=True, type='ocr', ocr_version='PP-OCRv4', structure_version='PP-StructureV2', use_textline_orientation=False)
[INFO] PaddleOCR initialized for fast processing
[INFO] Processing PDF: OCR/test_data/SamplePolicy.pdf
[INFO] Converting PDF with 1 pages to images
[INFO] Converted PDF page 1/1 to /tmp/tmp2cmjz5f_.png
[INFO] Processing PDF page 1/1
[2026/07/03 02:49:36] ppocr WARNING: Since the angle classifier is not initialized, it will not be used during the forward process
[2026/07/03 02:49:37] ppocr DEBUG: dt_boxes num : 22, elapsed : 0.3112609386444092
[2026/07/03 02:49:38] ppocr DEBUG: rec_res num  : 22, elapsed : 1.0660209655761719
[DEBUG] OCR result type: <class 'list'>
[DEBUG] Page result type: <class 'list'>
[DEBUG] Page 1 detailed type: <class 'tuple'>
[DEBUG] Cleaned up /tmp/tmp2cmjz5f_.png
[INFO] PDF processing completed: 13 total text blocks
[INFO] OCR completed in 1.70s
[INFO] Extracted 13 text blocks
[INFO] Sending prompt to Ollama (length: 4901 chars)
[DEBUG] Prompt preview: Extract data from this insurance document text and return JSON:

: JA2024-567890\n1975322 \n1*1-2-3\n: 2022 \n*: ABC123XYZ789\n5004567\nAH  Vy+-\n 2024  4  1~2025  3 31 \n: Y85,400\nxf#J#FR\nx R\nj: 3...
[DEBUG] Raw AI response: ...
[DEBUG] Full response length: 0
[DEBUG] No braces found, using full content
[ERROR] JSON parsing failed: Expecting value: line 1 column 1 (char 0)
[ERROR] Attempted to parse: ...
[INFO] AI processing completed in 18.66s
[SUCCESS] Total processing time: 20.36s
{
  "policy_number": "",
  "effective_dates": {
    "start": "",
    "end": ""
  },
  "policyholder_details": {
    "full_name": "",
    "address": "",
    "city_state_zip": "",
    "phone": "",
    "email": "",
    "dob": "",
    "gender": "",
    "marital_status": ""
  },
  "policy_information": {
    "policy_type": "",
    "issue_date": "",
    "term_length": "",
    "renewal_date": "",
    "agent": "",
    "agent_id": "",
    "office_phone": ""
  },
  "insured_vehicle": {
    "year": "",
    "make": "",
    "model": "",
    "vin": "",
    "license_plate": "",
    "body_type": "",
    "usage_class": "",
    "mileage": "",
    "garage_zip": ""
  },
  "driver_profile": {
    "primary_driver": "",
    "license_no": "",
    "license_date": "",
    "license_status": "",
    "age_group": "",
    "driving_record": "",
    "relationship": ""
  },
  "billing": {
    "payment_method": "",
    "payment_plan": "",
    "monthly_amount": "",
    "next_due_date": "",
    "bank_account": "",
    "total_premium": "",
    "payment_status": ""
  },
  "discounts": {
    "good_driver": "",
    "multi_policy": "",
    "vehicle_safety": "",
    "defensive_driving": "",
    "federal_employee": "",
    "total_savings": ""
  },
  "coverage_limits": [],
  "text_blocks": [
    {
      "text": ": JA2024-567890",
      "confidence": 0.9686838388442993,
      "bbox": "[[262.0, 603.0], [820.0, 603.0], [820.0, 654.0], [262.0, 654.0]]"
    },
    {
      "text": "1975322 ",
      "confidence": 0.9733186960220337,
      "bbox": "[[251.0, 796.0], [901.0, 800.0], [901.0, 863.0], [251.0, 859.0]]"
    },
    {
      "text": "1*1-2-3",
      "confidence": 0.7361959218978882,
      "bbox": "[[258.0, 906.0], [916.0, 906.0], [916.0, 957.0], [258.0, 957.0]]"
    },
    {
      "text": ": 2022 ",
      "confidence": 0.9760593175888062,
      "bbox": "[[262.0, 1330.0], [561.0, 1330.0], [561.0, 1381.0], [262.0, 1381.0]]"
    },
    {
      "text": "*: ABC123XYZ789",
      "confidence": 0.9447125792503357,
      "bbox": "[[259.0, 1429.0], [857.0, 1433.0], [856.0, 1487.0], [258.0, 1483.0]]"
    },
    {
      "text": "5004567",
      "confidence": 0.9963492751121521,
      "bbox": "[[266.0, 1535.0], [864.0, 1535.0], [864.0, 1586.0], [266.0, 1586.0]]"
    },
    {
      "text": "AH  Vy+-",
      "confidence": 0.6298880577087402,
      "bbox": "[[262.0, 1637.0], [831.0, 1637.0], [831.0, 1688.0], [262.0, 1688.0]]"
    },
    {
      "text": " 2024  4  1~2025  3 31 ",
      "confidence": 0.847119927406311,
      "bbox": "[[262.0, 1959.0], [1322.0, 1959.0], [1322.0, 2010.0], [262.0, 2010.0]]"
    },
    {
      "text": ": Y85,400",
      "confidence": 0.9202039241790771,
      "bbox": "[[255.0, 2053.0], [724.0, 2057.0], [723.0, 2120.0], [255.0, 2116.0]]"
    },
    {
      "text": "xf#J#FR",
      "confidence": 0.544778048992157,
      "bbox": "[[262.0, 2485.0], [746.0, 2485.0], [746.0, 2536.0], [262.0, 2536.0]]"
    },
    {
      "text": "x R",
      "confidence": 0.5661458373069763,
      "bbox": "[[266.0, 2587.0], [746.0, 2587.0], [746.0, 2638.0], [266.0, 2638.0]]"
    },
    {
      "text": "j: 300 F",
      "confidence": 0.781891405582428,
      "bbox": "[[262.0, 2686.0], [687.0, 2690.0], [686.0, 2744.0], [262.0, 2740.0]]"
    },
    {
      "text": "3: 2024  3  15 ",
      "confidence": 0.901004433631897,
      "bbox": "[[255.0, 2890.0], [849.0, 2894.0], [849.0, 2956.0], [255.0, 2952.0]]"
    }
  ],
  "raw_ocr_text": ": JA2024-567890\\n1975322 \\n1*1-2-3\\n: 2022 \\n*: ABC123XYZ789\\n5004567\\nAH  Vy+-\\n 2024  4  1~2025  3 31 \\n: Y85,400\\nxf#J#FR\\nx R\\nj: 300 F\\n3: 2024  3  15",
  "document_metadata": {
    "filename": "OCR/test_data/SamplePolicy.pdf",
    "extraction_timestamp": "2026-07-03 02:49:57 JST",
    "document_language": "en",
    "document_type": "auto_insurance_policy",
    "processing_method": "fast_paddleocr_plus_ollama_gpu"
  },
  "accuracy_metrics": {
    "ocr_confidence": 0.8297193279633155,
    "extraction_completeness": 0,
    "field_accuracy_estimates": {}
  },
  "processing_metrics": {
    "paddleocr_time_seconds": 1.696823,
    "ai_processing_time_seconds": 18.661357,
    "total_time_seconds": 20.35824
  }
}
╭─ ~/projects/pocs/AIG/InsuranceAIPOCs  main !1 ?2 ─────────────────────────── ✔  5m 40s  root@aig  02:49:57 ─╮
╰─ docker compose exec backend python3 OCR/paddleocr_to_json.py OCR/test_data/SamplePolicy.pdf                   ─╯
[SUCCESS] PyMuPDF imported - PDF support enabled
[SUCCESS] PaddleOCR imported successfully
[2026/07/03 02:51:35] ppocr DEBUG: Namespace(help='==SUPPRESS==', use_gpu=False, use_xpu=False, use_npu=False, ir_optim=True, use_tensorrt=False, min_subgraph_size=15, precision='fp32', gpu_mem=500, gpu_id=0, image_dir=None, page_num=0, det_algorithm='DB', det_model_dir='/root/.paddleocr/whl/det/en/en_PP-OCRv3_det_infer', det_limit_side_len=960, det_limit_type='max', det_box_type='quad', det_db_thresh=0.3, det_db_box_thresh=0.6, det_db_unclip_ratio=1.5, max_batch_size=10, use_dilation=False, det_db_score_mode='fast', det_east_score_thresh=0.8, det_east_cover_thresh=0.1, det_east_nms_thresh=0.2, det_sast_score_thresh=0.5, det_sast_nms_thresh=0.2, det_pse_thresh=0, det_pse_box_thresh=0.85, det_pse_min_area=16, det_pse_scale=1, scales=[8, 16, 32], alpha=1.0, beta=1.0, fourier_degree=5, rec_algorithm='SVTR_LCNet', rec_model_dir='/root/.paddleocr/whl/rec/en/en_PP-OCRv4_rec_infer', rec_image_inverse=True, rec_image_shape='3, 48, 320', rec_batch_num=6, max_text_length=25, rec_char_dict_path='/usr/local/lib/python3.11/dist-packages/paddleocr/ppocr/utils/en_dict.txt', use_space_char=True, vis_font_path='./doc/fonts/simfang.ttf', drop_score=0.5, e2e_algorithm='PGNet', e2e_model_dir=None, e2e_limit_side_len=768, e2e_limit_type='max', e2e_pgnet_score_thresh=0.5, e2e_char_dict_path='./ppocr/utils/ic15_dict.txt', e2e_pgnet_valid_set='totaltext', e2e_pgnet_mode='fast', use_angle_cls=False, cls_model_dir='/root/.paddleocr/whl/cls/ch_ppocr_mobile_v2.0_cls_infer', cls_image_shape='3, 48, 192', label_list=['0', '180'], cls_batch_num=6, cls_thresh=0.9, enable_mkldnn=False, cpu_threads=10, use_pdserving=False, warmup=False, sr_model_dir=None, sr_image_shape='3, 32, 128', sr_batch_num=1, draw_img_save_dir='./inference_results', save_crop_res=False, crop_res_save_dir='./output', use_mp=False, total_process_num=1, process_id=0, benchmark=False, save_log_path='./log_output/', show_log=True, use_onnx=False, output='./output', table_max_len=488, table_algorithm='TableAttn', table_model_dir=None, merge_no_span_structure=True, table_char_dict_path=None, layout_model_dir=None, layout_dict_path=None, layout_score_threshold=0.5, layout_nms_threshold=0.5, kie_algorithm='LayoutXLM', ser_model_dir=None, re_model_dir=None, use_visual_backbone=True, ser_dict_path='../train_data/XFUND/class_list_xfun.txt', ocr_order_method=None, mode='structure', image_orientation=False, layout=True, table=True, ocr=True, recovery=False, use_pdf2docx_api=False, invert=False, binarize=False, alphacolor=(255, 255, 255), lang='en', det=True, rec=True, type='ocr', ocr_version='PP-OCRv4', structure_version='PP-StructureV2', use_textline_orientation=False)
[INFO] PaddleOCR initialized for fast processing
[INFO] Processing PDF: OCR/test_data/SamplePolicy.pdf
[INFO] Converting PDF with 1 pages to images
[INFO] Converted PDF page 1/1 to /tmp/tmphwwefqct.png
[INFO] Processing PDF page 1/1
[2026/07/03 02:51:35] ppocr WARNING: Since the angle classifier is not initialized, it will not be used during the forward process
[2026/07/03 02:51:36] ppocr DEBUG: dt_boxes num : 22, elapsed : 0.24001383781433105
[2026/07/03 02:51:37] ppocr DEBUG: rec_res num  : 22, elapsed : 1.0908668041229248
[DEBUG] OCR result type: <class 'list'>
[DEBUG] Page result type: <class 'list'>
[DEBUG] Page 1 detailed type: <class 'tuple'>
[DEBUG] Cleaned up /tmp/tmphwwefqct.png
[INFO] PDF processing completed: 13 total text blocks
[INFO] OCR completed in 1.60s
[INFO] Extracted 13 text blocks
[INFO] Sending prompt to Ollama (length: 4901 chars)
[DEBUG] Prompt preview: Extract data from this insurance document text and return JSON:

: JA2024-567890\n1975322 \n1*1-2-3\n: 2022 \n*: ABC123XYZ789\n5004567\nAH  Vy+-\n 2024  4  1~2025  3 31 \n: Y85,400\nxf#J#FR\nx R\nj: 3...
[DEBUG] Raw AI response: ...
[DEBUG] Full response length: 0
[DEBUG] No braces found, using full content
[ERROR] JSON parsing failed: Expecting value: line 1 column 1 (char 0)
[ERROR] Attempted to parse: ...
[INFO] AI processing completed in 14.11s
[SUCCESS] Total processing time: 15.71s
{
  "policy_number": "",
  "effective_dates": {
    "start": "",
    "end": ""
  },
  "policyholder_details": {
    "full_name": "",
    "address": "",
    "city_state_zip": "",
    "phone": "",
    "email": "",
    "dob": "",
    "gender": "",
    "marital_status": ""
  },
  "policy_information": {
    "policy_type": "",
    "issue_date": "",
    "term_length": "",
    "renewal_date": "",
    "agent": "",
    "agent_id": "",
    "office_phone": ""
  },
  "insured_vehicle": {
    "year": "",
    "make": "",
    "model": "",
    "vin": "",
    "license_plate": "",
    "body_type": "",
    "usage_class": "",
    "mileage": "",
    "garage_zip": ""
  },
  "driver_profile": {
    "primary_driver": "",
    "license_no": "",
    "license_date": "",
    "license_status": "",
    "age_group": "",
    "driving_record": "",
    "relationship": ""
  },
  "billing": {
    "payment_method": "",
    "payment_plan": "",
    "monthly_amount": "",
    "next_due_date": "",
    "bank_account": "",
    "total_premium": "",
    "payment_status": ""
  },
  "discounts": {
    "good_driver": "",
    "multi_policy": "",
    "vehicle_safety": "",
    "defensive_driving": "",
    "federal_employee": "",
    "total_savings": ""
  },
  "coverage_limits": [],
  "text_blocks": [
    {
      "text": ": JA2024-567890",
      "confidence": 0.9686838388442993,
      "bbox": "[[262.0, 603.0], [820.0, 603.0], [820.0, 654.0], [262.0, 654.0]]"
    },
    {
      "text": "1975322 ",
      "confidence": 0.9733186960220337,
      "bbox": "[[251.0, 796.0], [901.0, 800.0], [901.0, 863.0], [251.0, 859.0]]"
    },
    {
      "text": "1*1-2-3",
      "confidence": 0.7361959218978882,
      "bbox": "[[258.0, 906.0], [916.0, 906.0], [916.0, 957.0], [258.0, 957.0]]"
    },
    {
      "text": ": 2022 ",
      "confidence": 0.9760593175888062,
      "bbox": "[[262.0, 1330.0], [561.0, 1330.0], [561.0, 1381.0], [262.0, 1381.0]]"
    },
    {
      "text": "*: ABC123XYZ789",
      "confidence": 0.9447125792503357,
      "bbox": "[[259.0, 1429.0], [857.0, 1433.0], [856.0, 1487.0], [258.0, 1483.0]]"
    },
    {
      "text": "5004567",
      "confidence": 0.9963492751121521,
      "bbox": "[[266.0, 1535.0], [864.0, 1535.0], [864.0, 1586.0], [266.0, 1586.0]]"
    },
    {
      "text": "AH  Vy+-",
      "confidence": 0.6298880577087402,
      "bbox": "[[262.0, 1637.0], [831.0, 1637.0], [831.0, 1688.0], [262.0, 1688.0]]"
    },
    {
      "text": " 2024  4  1~2025  3 31 ",
      "confidence": 0.847119927406311,
      "bbox": "[[262.0, 1959.0], [1322.0, 1959.0], [1322.0, 2010.0], [262.0, 2010.0]]"
    },
    {
      "text": ": Y85,400",
      "confidence": 0.9202039241790771,
      "bbox": "[[255.0, 2053.0], [724.0, 2057.0], [723.0, 2120.0], [255.0, 2116.0]]"
    },
    {
      "text": "xf#J#FR",
      "confidence": 0.544778048992157,
      "bbox": "[[262.0, 2485.0], [746.0, 2485.0], [746.0, 2536.0], [262.0, 2536.0]]"
    },
    {
      "text": "x R",
      "confidence": 0.5661458373069763,
      "bbox": "[[266.0, 2587.0], [746.0, 2587.0], [746.0, 2638.0], [266.0, 2638.0]]"
    },
    {
      "text": "j: 300 F",
      "confidence": 0.781891405582428,
      "bbox": "[[262.0, 2686.0], [687.0, 2690.0], [686.0, 2744.0], [262.0, 2740.0]]"
    },
    {
      "text": "3: 2024  3  15 ",
      "confidence": 0.901004433631897,
      "bbox": "[[255.0, 2890.0], [849.0, 2894.0], [849.0, 2956.0], [255.0, 2952.0]]"
    }
  ],
  "raw_ocr_text": ": JA2024-567890\\n1975322 \\n1*1-2-3\\n: 2022 \\n*: ABC123XYZ789\\n5004567\\nAH  Vy+-\\n 2024  4  1~2025  3 31 \\n: Y85,400\\nxf#J#FR\\nx R\\nj: 300 F\\n3: 2024  3  15",
  "document_metadata": {
    "filename": "OCR/test_data/SamplePolicy.pdf",
    "extraction_timestamp": "2026-07-03 02:51:51 JST",
    "document_language": "en",
    "document_type": "auto_insurance_policy",
    "processing_method": "fast_paddleocr_plus_ollama_gpu"
  },
  "accuracy_metrics": {
    "ocr_confidence": 0.8297193279633155,
    "extraction_completeness": 0,
    "field_accuracy_estimates": {}
  },
  "processing_metrics": {
    "paddleocr_time_seconds": 1.59731,
    "ai_processing_time_seconds": 14.113964,
    "total_time_seconds": 15.711317
  }
}
╭─ ~/projects/pocs/AIG/InsuranceAIPOCs  main !2 ?2 ────────────────────────────── ✔  19s  root@aig  02:51:51 ─╮
╰─                                                                                                               ─╯