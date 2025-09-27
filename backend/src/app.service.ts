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

      return {
        status: 'success',
        message: 'Image processed successfully',
        data: ocrResult,
      };
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

          // Extract the last JSON-like line from stdout
          const lines = stdout.trim().split('\n');
          let jsonLine: string | undefined = lines.pop();
          while (lines.length && jsonLine && !jsonLine.trim().startsWith('{')) {
            jsonLine = lines.pop();
          }

          if (!jsonLine || !jsonLine.trim().startsWith('{')) {
            reject(new Error('No valid JSON output from OCR script'));
            return;
          }

          try {
            const result = JSON.parse(jsonLine);
            // Ensure the returned structure matches the Angular model
            resolve({
              status: result.status || 'success',
              image_path: result.image_path,
              text_blocks: result.text_blocks,
              full_text: result.full_text,
              message: result.message,
              error: result.error,
            });
          } catch (parseErr) {
            reject(new Error('Failed to parse OCR JSON output: ' + parseErr.message));
          }
        });
      });
    }
}