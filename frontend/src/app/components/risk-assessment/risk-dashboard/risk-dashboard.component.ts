import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
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

  constructor(private riskService: RiskAssessmentService, private router: Router) {}

  ngOnInit() {
    this.riskService.riskScore$.subscribe(score => {
      this.currentRiskScore = score;
    });
    // Set default risk score to first driver
    if (!this.currentRiskScore && this.driverProfiles.length > 0) {
      this.analyzeDriver(this.driverProfiles[0].id);
    }
  }

  analyzeDriver(driverId: string) {
    this.loading = true;
    const selectedDriver = this.driverProfiles.find(driver => driver.id === driverId);
    if (!selectedDriver) {
      this.loading = false;
      return;
    }
    // Use the selected driver's riskScore, category, and discount directly
    this.currentRiskScore = {
      driverId: selectedDriver.id,
      riskScore: selectedDriver.riskScore,
      riskCategory: selectedDriver.category as 'low' | 'medium' | 'high' | 'very-high',
      recommendedPremium: this.calculatePremium(selectedDriver),
      discount: this.calculateDiscount(selectedDriver),
      factors: this.generateRiskFactors(selectedDriver),
      timestamp: new Date()
    };
    this.loading = false;
  }

  private calculatePremium(driver: any): number {
    const basePremium = 50000;
    const riskMultiplier: {[key: string]: number} = {
      'low': 0.8,
      'medium': 1.0,
      'high': 1.3,
      'very-high': 1.6
    };
    return Math.round(basePremium * (riskMultiplier[driver.category] || 1.0));
  }

  private calculateDiscount(driver: any): number {
    const discountRates: {[key: string]: number} = {
      'low': 9500,
      'medium': 5000,
      'high': 0,
      'very-high': 0
    };
    return discountRates[driver.category] || 0;
  }

  private generateRiskFactors(driver: any): any {
    return {
      ageRisk: driver.age < 25 ? 80 : driver.age > 65 ? 60 : 30,
      experienceRisk: driver.age < 25 ? 70 : 20,
      behaviorRisk: driver.category === 'very-high' ? 90 : driver.category === 'high' ? 60 : 20,
      vehicleRisk: 25,
      regionRisk: 15
    };
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

  getRiskLabel(category: string): string {
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

  returnHome() {
    this.router.navigate(['/']);
  }
}