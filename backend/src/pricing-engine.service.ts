import { Injectable } from '@nestjs/common';

@Injectable()
export class PricingEngineService {
  calculatePremium(riskScore: number, basePremium: number): number {
    const riskMultiplier = 0.5 + (riskScore / 100) * 1.0;
    return Math.round(basePremium * riskMultiplier);
  }

  calculatePayAsYouDrive(mileage: number, riskScore: number): number {
    const baseRate = 5;
    const riskAdjustment = 1 + (riskScore / 100);
    return Math.round(mileage * baseRate * riskAdjustment);
  }

  calculateDiscount(safetyScore: number): number {
    if (safetyScore > 90) return 0.20;
    if (safetyScore > 80) return 0.15;
    if (safetyScore > 70) return 0.10;
    return 0;
  }
}