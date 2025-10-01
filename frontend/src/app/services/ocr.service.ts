import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, timeout, tap } from 'rxjs';
import { OcrResponse } from '../models/ocr-response.model';

@Injectable({
  providedIn: 'root',
})
export class OcrService {
  private apiUrl = 'http://localhost:3000/api/upload-image';

  constructor(private http: HttpClient) {}

  uploadImage(file: File): Observable<OcrResponse> {
    const formData = new FormData();
    formData.append('image', file, file.name);
    
    console.log('ANGULAR SERVICE: Sending image to NestJS backend');
    console.log('ANGULAR SERVICE: Image file size:', file.size);
    
    return this.http.post<OcrResponse>(this.apiUrl, formData).pipe(
      tap(() => console.log('ANGULAR SERVICE: Image HTTP request sent successfully')),
      timeout(300000), // 5 minute timeout
      tap((response) => console.log('ANGULAR SERVICE: Image HTTP response received:', Object.keys(response))),
      catchError((error: HttpErrorResponse) => {
        console.error('ANGULAR SERVICE: HTTP Error uploading image:', error);
        console.error('ANGULAR SERVICE: Error status:', error.status);
        console.error('ANGULAR SERVICE: Error message:', error.message);
        throw error;
      })
    );
  }

  processRawText(rawText: string): Observable<OcrResponse> {
    const rawApiUrl = 'http://localhost:3000/api/process-raw-text';
    
    console.log('ANGULAR SERVICE: Sending raw text to NestJS for Ollama processing');
    console.log('ANGULAR SERVICE: Raw text length:', rawText.length);
    
    return this.http.post<OcrResponse>(rawApiUrl, { rawText }).pipe(
      tap(() => console.log('ANGULAR SERVICE: HTTP request sent successfully')),
      timeout(300000), // 5 minute timeout
      tap((response) => console.log('ANGULAR SERVICE: HTTP response received:', Object.keys(response))),
      catchError((error: HttpErrorResponse) => {
        console.error('ANGULAR SERVICE: HTTP Error processing raw text:', error);
        console.error('ANGULAR SERVICE: Error status:', error.status);
        console.error('ANGULAR SERVICE: Error message:', error.message);
        throw error;
      })
    );
  }
}
