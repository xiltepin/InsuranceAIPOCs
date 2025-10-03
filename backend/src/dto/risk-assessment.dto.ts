export class DriverProfileDto {
  driverId: string;
  age: number;
  licenseNumber: string;
  licenseIssueDate: Date;
  vehicleType: 'kei' | 'standard' | 'large';
  annualMileage?: number;
  previousAccidents?: number;
}

export class DrivingBehaviorDto {
  driverId: string;
  averageSpeed: number;
  harshBraking: number;
  harshAcceleration: number;
  nightDriving: number;
  highwayDriving: number;
  idleTime: number;
  tripCount: number;
  period: string;
}

export interface RiskScoreDto {
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