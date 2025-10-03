import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { RiskAssessmentService, RiskScore } from '../../../services/risk-assessment/risk-assessment.service';

@Component({
  selector: 'app-risk-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './risk-dashboard.component.html',
  styleUrls: ['./risk-dashboard.component.scss']
})
export class RiskDashboardComponent implements OnInit {
  currentRiskScore: RiskScore | null = null;
  loading = false;
  scenarios = ['newDriver', 'elderly', 'safeDriving'];
  selectedScenario = 'safeDriving';

  driverProfiles = [
    { id: 'D001', name: 'Taro Tanaka', age: 45, riskScore: 35, category: 'low' },
    { id: 'D002', name: 'Hanako Sato', age: 68, riskScore: 62, category: 'high' },
    { id: 'D003', name: 'Ichiro Suzuki', age: 23, riskScore: 75, category: 'very-high' },
  ];

  constructor(private riskService: RiskAssessmentService) {}

  ngOnInit() {
    this.riskService.riskScore$.subscribe(score => {
      this.currentRiskScore = score;
    });
  }

  analyzeDriver(driverId: string) {
    this.loading = true;
    const profile = {
      driverId,
      age: 45,
      licenseNumber: 'TKY-123456',
      licenseIssueDate: new Date('2010-01-01'),
      vehicleType: 'kei' as const,
      annualMileage: 8000,
      previousAccidents: 0
    };

    this.riskService.analyzeRisk(profile).subscribe({
      next: (score) => {
        this.currentRiskScore = score;
        this.loading = false;
      },
      error: (err) => {
        console.error('Risk analysis failed:', err);
        this.loading = false;
      }
    });
  }

  simulateScenario() {
    this.loading = true;
    this.riskService.simulateScenario({ type: this.selectedScenario }).subscribe({
      next: (result) => {
        console.log('Simulation result:', result);
        this.loading = false;
      },
      error: (err) => {
        console.error('Simulation failed:', err);
        this.loading = false;
      }
    });
  }

  getRiskColor(category: string): string {
    const colors: {[key: string]: string} = {
      'low': '#10b981',
      'medium': '#f59e0b',
      'high': '#ef4444',
      'very-high': '#dc2626'
    };
    return colors[category] || '#6b7280';
  }

  getJapaneseRiskLabel(category: string): string {
    const labels: {[key: string]: string} = {
      'low': 'Low Risk',
      'medium': 'Medium Risk',
      'high': 'High Risk',
      'very-high': 'Very High Risk'
    };
    return labels[category] || 'Unknown Risk';
  }

  getFactorArray(factors: any) {
    return [
      { label: 'Age Risk', value: factors.ageRisk },
      { label: 'Experience Risk', value: factors.experienceRisk },
      { label: 'Driving Behavior Risk', value: factors.behaviorRisk },
      { label: 'Vehicle Risk', value: factors.vehicleRisk },
      { label: 'Regional Risk', value: factors.regionRisk }
    ];
  }
}