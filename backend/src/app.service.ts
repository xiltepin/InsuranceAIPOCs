import { Injectable } from '@nestjs/common';
import * as path from 'path';
import { exec } from 'child_process';
import * as fs from 'fs';

@Injectable()
export class AppService {
  async uploadImage(file: Express.Multer.File): Promise<any> {
    console.log('Received file:', file);
    try {
      const rawDataDir = path.resolve(__dirname, '../uploads');
      if (!fs.existsSync(rawDataDir)) {
        fs.mkdirSync(rawDataDir, { recursive: true });
        console.log('Created uploads directory:', rawDataDir);
      }

      const imagePath = file.path;
      const resolvedPath = path.resolve(imagePath);
      console.log('File saved to:', imagePath);
      console.log('Resolved absolute path:', resolvedPath);
      if (!fs.existsSync(resolvedPath)) {
        console.error('File does not exist at resolved path:', resolvedPath);
        throw new Error(`Uploaded file not found at path: ${resolvedPath}`);
      }

      const ocrResult = await this.processOCR(resolvedPath);

      // Return the full OCR JSON result directly
      return ocrResult;
    } catch (error) {
      console.error('Upload Error Details:', error);
      throw new Error(`Failed to process image: ${error.message}`);
    }
  }

  // (Old processOCR removed, replaced by robust version below)
    async processOCR(imagePath: string): Promise<any> {
      // Use the robust paddleocr_to_json.py script
      const ocrScriptPath = path.join(__dirname, '../../OCR/paddleocr_to_json.py');
      const absoluteImagePath = path.resolve(imagePath);
      const command = `"C:\\Python313\\python.exe" "${ocrScriptPath}" "${absoluteImagePath}"`;
      console.log('Executing OCR command:', command);

      return new Promise((resolve, reject) => {
        exec(command, (error, stdout, stderr) => {
          if (error) {
            console.error('Exec Error:', error);
            console.error('Stderr:', stderr);
            reject(new Error(`OCR execution failed with code ${error.code}: ${stderr}`));
            return;
          }
          console.log('Raw OCR Output:', stdout);
          console.log('OCR Error:', stderr);

          // Attempt to parse the entire stdout as JSON (handles pretty-printed/multi-line JSON)
          let jsonText = stdout.trim();
          // Remove any leading/trailing non-JSON lines (if any)
          const firstBrace = jsonText.indexOf('{');
          const lastBrace = jsonText.lastIndexOf('}');
          if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
            jsonText = jsonText.substring(firstBrace, lastBrace + 1);
          }

          try {
            const result = JSON.parse(jsonText);
            resolve(result);
          } catch (parseErr) {
            reject(new Error('Failed to parse OCR JSON output: ' + parseErr.message + '\nRaw output:\n' + jsonText));
          }
        });
      });
    }
}