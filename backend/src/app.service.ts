import { Injectable } from '@nestjs/common';
import * as path from 'path';
import { spawn } from 'child_process';
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

  // Use spawn for real-time output streaming
    async processOCR(imagePath: string): Promise<any> {
      const ocrScriptPath = path.join(__dirname, '../../OCR/paddleocr_to_json.py');
      const absoluteImagePath = path.resolve(imagePath);
      
      console.log('==========================================');
      console.log('NESTJS: Starting OCR processing with real-time output');
      console.log('Script path:', ocrScriptPath);
      console.log('Image path:', absoluteImagePath);
      console.log('==========================================');

      return new Promise((resolve, reject) => {
        const pythonProcess = spawn('C:\\Python313\\python.exe', [ocrScriptPath, absoluteImagePath]);

        let stdout = '';
        let stderr = '';

        // Handle stdout (JSON result)
        pythonProcess.stdout.on('data', (data) => {
          const chunk = data.toString();
          stdout += chunk;
          console.log('PYTHON STDOUT CHUNK:', chunk);
        });

        // Handle stderr (our logs and debug info) - REAL TIME!
        pythonProcess.stderr.on('data', (data) => {
          const chunk = data.toString();
          stderr += chunk;
          console.log('PYTHON STDERR (REAL-TIME):', chunk);
        });

        // Handle process completion
        pythonProcess.on('close', (code) => {
          console.log('==========================================');
          console.log('NESTJS: Python process completed with code:', code);
          console.log('==========================================');
          
          if (code !== 0) {
            console.error('Python process failed with code:', code);
            console.error('Full stderr:', stderr);
            reject(new Error(`OCR execution failed with code ${code}: ${stderr}`));
            return;
          }

          console.log('==========================================');
          console.log('NESTJS: Complete stdout from Python script:');
          console.log('==========================================');
          console.log(stdout);
          console.log('==========================================');

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
            console.log('==========================================');
            console.log('NESTJS: Parsed JSON result to send back to Angular');
            console.log('==========================================');
            console.log('Result keys:', Object.keys(result));
            console.log('Result sample:', JSON.stringify(result, null, 2).substring(0, 500) + '...');
            console.log('==========================================');
            resolve(result);
          } catch (parseErr) {
            reject(new Error('Failed to parse OCR JSON output: ' + parseErr.message + '\nRaw output:\n' + jsonText));
          }
        });

        // Handle process errors
        pythonProcess.on('error', (error) => {
          console.error('Failed to start Python process:', error);
          reject(new Error(`Failed to start Python process: ${error.message}`));
        });
      });
    }
}