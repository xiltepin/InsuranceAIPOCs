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
import { RatingModule } from './rating/rating.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      password: process.env.DB_PASSWORD || 'postgres',
      username: process.env.DB_USERNAME || 'postgres',
      entities: [],
      database: process.env.DB_NAME || 'insurance_poc',
      synchronize: true,
      logging: true,
    }),
    CustomerInfoModule,
    PrismaModule,
    RatingModule,
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