import { Controller, Post, Get, Body, Param, Query } from '@nestjs/common';
import { RiskAssessmentService } from './risk-assessment.service';
import { DriverProfileDto, DrivingBehaviorDto, RiskScoreDto } from './dto/risk-assessment.dto';

@Controller('risk-assessment')
export class RiskAssessmentController {
  constructor(private readonly riskService: RiskAssessmentService) {}

  @Post('analyze')
  async analyzeRisk(@Body() profile: DriverProfileDto): Promise<RiskScoreDto> {
    return this.riskService.calculateRiskScore(profile);
  }

  @Post('behavior/update')
  async updateBehavior(@Body() behavior: DrivingBehaviorDto) {
    return this.riskService.updateDrivingBehavior(behavior);
  }

  @Get('premium/:driverId')
  async calculatePremium(
    @Param('driverId') driverId: string,
    @Query('basePremium') basePremium: number,
  ) {
    return this.riskService.calculateDynamicPremium(driverId, basePremium);
  }

  @Get('iot/:deviceId/data')
  async getIoTData(@Param('deviceId') deviceId: string) {
    return this.riskService.getRealtimeIoTData(deviceId);
  }

  @Post('simulate')
  async simulateScenario(@Body() scenario: any) {
    return this.riskService.simulateRiskScenario(scenario);
  }
}