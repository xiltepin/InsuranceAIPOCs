import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { RiskAssessmentController } from './risk-assessment.controller';
import { RiskAssessmentService } from './risk-assessment.service';
import { IoTIntegrationService } from './iot-integration.service';
import { PricingEngineService } from './pricing-engine.service';

@Module({
  imports: [],
  controllers: [
    AppController,
    RiskAssessmentController,
  ],
  providers: [
    AppService,
    RiskAssessmentService,
    IoTIntegrationService,
    PricingEngineService,
  ],
})
export class AppModule {}