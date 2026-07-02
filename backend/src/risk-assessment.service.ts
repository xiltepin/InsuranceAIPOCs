import { Injectable, Logger } from '@nestjs/common';
import { IoTIntegrationService } from './iot-integration.service';
import { PricingEngineService } from './pricing-engine.service';
import { HttpService } from '@nestjs/axios';
import { lastValueFrom } from 'rxjs';

interface RiskScoreDto {
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

@Injectable()
export class RiskAssessmentService {
  private driverBehaviorCache = new Map<string, any[]>();
  private readonly logger = new Logger(RiskAssessmentService.name);

  constructor(
    private iotService: IoTIntegrationService,
    private pricingEngine: PricingEngineService,
    private httpService: HttpService,
  ) {}

  async calculateRiskScore(profile: any): Promise<RiskScoreDto> {
    let annual_km_band = '10,001〜15,000';
    const mileage = profile.annualMileage || 12000;
    if (mileage <= 5000) annual_km_band = '〜5,000';
    else if (mileage <= 10000) annual_km_band = '5,001〜10,000';
    else if (mileage <= 15000) annual_km_band = '10,001〜15,000';
    else if (mileage <= 20000) annual_km_band = '15,001〜20,000';
    else annual_km_band = '20,001〜';

    let yearsLicensed = 10;
    if (profile.licenseIssueDate) {
      yearsLicensed = Math.floor((new Date().getTime() - new Date(profile.licenseIssueDate).getTime()) / (1000 * 60 * 60 * 24 * 365));
      if (yearsLicensed < 0) yearsLicensed = 0;
    }

    const ratingRequest = {
      ncd_grade: profile.ncdGrade || 6,
      age_condition: '26+',
      prefecture_code: profile.prefectureCode || '13',
      vehicle_rating_class: profile.vehicleRatingClass || 5,
      driver_restriction: profile.driverRestriction || 'none',
      annual_km_band: annual_km_band,
      driver_age: profile.age || 35,
      num_accidents: profile.previousAccidents || 0,
      num_violations: profile.numViolations || 0,
      years_licensed: yearsLicensed,
      mode: 'hybrid'
    };

    let mlData: any = null;
    try {
      const response = await lastValueFrom(
        this.httpService.post('http://localhost:8000/predict', ratingRequest)
      );
      mlData = response.data;
    } catch (error) {
      this.logger.warn(`Failed to call rating-engine ML API: ${error.message}. Falling back to local logic.`);
    }

    const ageRisk = this.calculateAgeRisk(profile.age);
    const experienceRisk = this.calculateExperienceRisk(profile.licenseIssueDate);
    const vehicleRisk = this.calculateVehicleRisk(profile.vehicleType);
    const behaviorRisk = await this.calculateBehaviorRisk(profile.driverId);
    const regionRisk = 0.15;

    const totalRisk = (
      ageRisk * 0.25 +
      experienceRisk * 0.20 +
      behaviorRisk * 0.35 +
      vehicleRisk * 0.10 +
      regionRisk * 0.10
    );

    const riskScore = Math.round(totalRisk * 100);
    const riskCategory = mlData?.risk_tier ? mlData.risk_tier.toLowerCase().replace(' ', '-') : this.getRiskCategory(riskScore);
    const basePremium = 50000;
    
    // If ML data is available, use its premium, otherwise fallback to local pricing engine
    let adjustedPremium = basePremium;
    if (mlData?.annual_premium_jpy) {
       adjustedPremium = mlData.annual_premium_jpy;
    } else {
       adjustedPremium = this.pricingEngine.calculatePremium(riskScore, basePremium);
    }
    
    const discount = Math.max(0, basePremium - adjustedPremium);

    return {
      driverId: profile.driverId,
      riskScore,
      riskCategory: riskCategory as any,
      factors: {
        ageRisk: Math.round(ageRisk * 100),
        experienceRisk: Math.round(experienceRisk * 100),
        behaviorRisk: Math.round(behaviorRisk * 100),
        vehicleRisk: Math.round(vehicleRisk * 100),
        regionRisk: Math.round(regionRisk * 100),
      },
      recommendedPremium: adjustedPremium,
      discount,
      timestamp: new Date(),
    };
  }

  private calculateAgeRisk(age: number): number {
    if (age >= 65) return 0.85;
    if (age < 25) return 0.75;
    if (age >= 25 && age < 35) return 0.45;
    if (age >= 35 && age < 50) return 0.25;
    return 0.40;
  }

  private calculateExperienceRisk(licenseDate: Date): number {
    const yearsExperience = (new Date().getTime() - new Date(licenseDate).getTime()) / (1000 * 60 * 60 * 24 * 365);
    if (yearsExperience < 1) return 0.95;
    if (yearsExperience < 3) return 0.70;
    if (yearsExperience < 5) return 0.45;
    return 0.20;
  }

  private calculateVehicleRisk(vehicleType: string): number {
    switch (vehicleType) {
      case 'kei': return 0.20;
      case 'standard': return 0.45;
      case 'large': return 0.65;
      default: return 0.50;
    }
  }

  private async calculateBehaviorRisk(driverId: string): Promise<number> {
    const behaviors = this.driverBehaviorCache.get(driverId) || [];
    if (behaviors.length === 0) return 0.50;

    const latest = behaviors[behaviors.length - 1];
    const brakingScore = Math.min(latest.harshBraking / 10, 1);
    const accelScore = Math.min(latest.harshAcceleration / 10, 1);
    const speedScore = latest.averageSpeed > 80 ? 0.7 : 0.3;
    const nightScore = latest.nightDriving > 30 ? 0.6 : 0.2;

    return (brakingScore * 0.3 + accelScore * 0.3 + speedScore * 0.25 + nightScore * 0.15);
  }

  private getRiskCategory(score: number): 'low' | 'medium' | 'high' | 'very-high' {
    if (score < 30) return 'low';
    if (score < 50) return 'medium';
    if (score < 70) return 'high';
    return 'very-high';
  }

  async updateDrivingBehavior(behavior: any) {
    const behaviors = this.driverBehaviorCache.get(behavior.driverId) || [];
    behaviors.push(behavior);
    if (behaviors.length > 6) behaviors.shift();
    this.driverBehaviorCache.set(behavior.driverId, behaviors);
    return { success: true, message: 'Behavior data updated' };
  }

  async calculateDynamicPremium(driverId: string, basePremium: number) {
    const mockProfile = {
      driverId,
      age: 45,
      licenseNumber: 'TKY-123456',
      licenseIssueDate: new Date('2010-01-01'),
      vehicleType: 'kei' as const,
      annualMileage: 8000,
    };

    const riskScore = await this.calculateRiskScore(mockProfile);
    const adjustedPremium = this.pricingEngine.calculatePremium(riskScore.riskScore, basePremium);

    return {
      basePremium,
      adjustedPremium,
      discount: basePremium - adjustedPremium,
      discountPercentage: Math.round(((basePremium - adjustedPremium) / basePremium) * 100),
      riskScore: riskScore.riskScore,
      riskCategory: riskScore.riskCategory,
    };
  }

  async getRealtimeIoTData(deviceId: string) {
    return this.iotService.fetchDeviceData(deviceId);
  }

  async simulateRiskScenario(scenario: any) {
    const scenarios = {
      newDriver: { age: 22, experience: 0.5, premium: 75000 },
      elderly: { age: 68, experience: 30, premium: 62000 },
      safeDriving: { age: 40, experience: 15, premium: 38000 },
    };

    return {
      scenario: scenario.type,
      result: scenarios[scenario.type] || scenarios.safeDriving,
      recommendations: this.generateRecommendations(scenario.type),
    };
  }

  private generateRecommendations(scenarioType: string): string[] {
    const recommendations = {
      newDriver: [
        'Install dashcam for behavior monitoring',
        'Enroll in defensive driving course',
        'Consider higher deductible for lower premium',
      ],
      elderly: [
        'Annual driving assessment recommended',
        'Consider limited mileage policy',
        'Enroll in senior driver safety program',
      ],
      safeDriving: [
        'Eligible for loyalty discount',
        'Consider usage-based insurance',
        'Multi-policy discount available',
      ],
    };
    return recommendations[scenarioType] || recommendations.safeDriving;
  }
}