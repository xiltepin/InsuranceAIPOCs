import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError } from 'rxjs';
import { OcrResponse } from '../models/ocr-response.model';

@Injectable({
  providedIn: 'root',
})
export class OcrService {
  private apiUrl = 'http://localhost:3000/api/upload-image';

  constructor(private http: HttpClient) {}

  uploadImage(file: File): Observable<OcrResponse> {
    const formData = new FormData();
    formData.append('image', file, file.name); // Include filename for clarity
    console.log('Sending request to:', this.apiUrl, 'with data:', formData);
    return this.http.post<OcrResponse>(this.apiUrl, formData).pipe(
      catchError((error: HttpErrorResponse) => {
        console.error('HTTP Error:', error);
        throw error;
      })
    );
  }
}