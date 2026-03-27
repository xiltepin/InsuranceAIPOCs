import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { RiskAssessmentController } from './risk-assessment.controller';
import { RiskAssessmentService } from './risk-assessment.service';
import { IoTIntegrationService } from './iot-integration.service';
import { PricingEngineService } from './pricing-engine.service';
import { PrismaService } from "./prisma/prisma.service";
import { CustomerInfoModule } from './customer-info/customer-info.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: 'localhost',
      port: 5432,
      password: 'postgres',
      username: 'postgres',
      entities: [],
      database: 'postgres',
      synchronize: true,
      logging: true,
    }),
    CustomerInfoModule,
    PrismaModule,
  ],
  controllers: [
    AppController,
    RiskAssessmentController,
  ],
  providers: [
    AppService,
    RiskAssessmentService,
    IoTIntegrationService,
    PricingEngineService,
    PrismaService,
  ],
})
export class AppModule {}