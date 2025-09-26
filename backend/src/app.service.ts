import { Injectable } from '@nestjs/common';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';

const execAsync = promisify(exec);

@Injectable()
export class AppService {
  getHello(): string {
    return 'OCR Backend Server is running!';
  }

  async processOCR(imagePath: string): Promise<any> {
    try {
      const ocrScriptPath = path.join(__dirname, '../../OCR/ocr_service.py');
      const command = `"C:\\Python313\\python.exe" "${ocrScriptPath}" "${imagePath}"`;
      
      console.log('Executing OCR command:', command);
      
      const { stdout, stderr } = await execAsync(command);
      
      // Log stderr for debugging, but only throw if it's a critical error
      if (stderr) {
        console.warn('OCR Warning/Output:', stderr);
        // Check if stderr contains only deprecation warnings and no critical errors
        if (stderr.includes('DeprecationWarning') && !stderr.includes('error') && !stderr.includes('exception')) {
          console.log('Deprecation warning ignored, proceeding with output.');
        } else {
          console.error('OCR Critical Error:', stderr);
          throw new Error('OCR processing failed: ' + stderr);
        }
      }

      console.log('OCR Output:', stdout);
      return JSON.parse(stdout);
    } catch (error) {
      console.error('OCR Service Error:', error);
      throw error;
    }
  }
}