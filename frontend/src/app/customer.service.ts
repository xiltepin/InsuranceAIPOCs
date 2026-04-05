import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class CustomerService {
  private apiUrl = environment.customersApiUrl;

  constructor(private http: HttpClient) { }

  getCustomers(): Observable<any> {
    return this.http.get(this.apiUrl);
  }
}
