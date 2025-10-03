import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';

export interface DriverProfile {
  driverId: string;
  age: number;
  licenseNumber: string;
  licenseIssueDate: Date;
  vehicleType: 'kei' | 'standard' | 'large';
  annualMileage?: number;
  previousAccidents?: number;
}

export interface RiskScore {
  driverId: string;
  riskScore: number;
  riskCategory: 'low' | 'medium' | 'high' | 'very-high';
  factors: {
    ageRisk: number;
    experienceRisk: number;
    behaviorRisk: number;
    vehicleRisk: number;
    regionRisk: number;
  };
  recommendedPremium: number;
  discount: number;
  timestamp: Date;
}

@Injectable({
  providedIn: 'root'
})
export class RiskAssessmentService {
  private apiUrl = 'http://localhost:3000/risk-assessment';
  private riskScoreSubject = new BehaviorSubject<RiskScore | null>(null);
  public riskScore$ = this.riskScoreSubject.asObservable();

  constructor(private http: HttpClient) {}

  analyzeRisk(profile: DriverProfile): Observable<RiskScore> {
    return this.http.post<RiskScore>(`${this.apiUrl}/analyze`, profile);
  }

  updateDrivingBehavior(behavior: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/behavior/update`, behavior);
  }

  calculatePremium(driverId: string, basePremium: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/premium/${driverId}?basePremium=${basePremium}`);
  }

  getIoTData(deviceId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/iot/${deviceId}/data`);
  }

  simulateScenario(scenario: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/simulate`, scenario);
  }

  updateRiskScore(score: RiskScore) {
    this.riskScoreSubject.next(score);
  }
}