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
      console.log('File saved to:', imagePath);

      const ocrResult = await this.processOCR(imagePath);

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

  async processOCR(imagePath: string): Promise<any> {
    const ocrScriptPath = path.join(__dirname, '../../OCR/ocr_service.py');
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
        let jsonLine: string | undefined = lines.pop(); // Initialize as string or undefined

        // Find the last line that starts with '{'
        while (lines.length && jsonLine && !jsonLine.startsWith('{')) {
          jsonLine = lines.pop();
        }

        if (!jsonLine || !jsonLine.startsWith('{')) {
          reject(new Error('No valid JSON output from OCR script'));
          return;
        }

        try {
          const result = JSON.parse(jsonLine);
          resolve(result);
        } catch (parseError) {
          console.error('OCR Parse Error:', parseError.message, 'on line:', jsonLine);
          reject(new Error(`Failed to parse OCR output: ${parseError.message}`));
        }
      });
    });
  }
}