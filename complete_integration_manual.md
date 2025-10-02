# 🚗 Risk Assessment POC - Complete Integration Manual
## Tailored for Your PCO Project Structure

---

## 📊 Your Current Project Structure

```
PCO/
├── frontend/ (Angular - Standalone Components - Port 4200)
│   └── src/app/
│       ├── components/
│       │   ├── home.component.ts
│       │   └── image-uploader/
│       ├── models/
│       ├── services/
│       ├── app.config.ts
│       ├── app.routes.ts
│       └── app.ts
│
├── backend/ (NestJS - Simple Structure - Port 3000)
│   └── src/
│       ├── app.controller.ts (OCR Upload)
│       ├── app.service.ts (Calls PaddleOCR)
│       ├── app.module.ts
│       └── main.ts
│
└── OCR/ (PaddleOCR - Python - Called directly by NestJS)
    └── paddleocr_to_json.py
```

---

## 🎯 Part 1: Backend Setup (NestJS)

### Step 1.1: Create Risk Assessment Files

```powershell
cd C:\Users\Edu\Documents\Chamba\AIG\OCR\PCO\backend\src

# Create new files for risk assessment
New-Item -ItemType File -Path "risk-assessment.controller.ts"
New-Item -ItemType File -Path "risk-assessment.service.ts"
New-Item -ItemType File -Path "iot-integration.service.ts"
New-Item -ItemType File -Path "pricing-engine.service.ts"
```

### Step 1.2: Create DTOs Folder

```powershell
# Create dto folder
New-Item -ItemType Directory -Path "dto"

# Create DTO file
New-Item -ItemType File -Path "dto\driver-profile.dto.ts"
```

### Step 1.3: Add Risk Assessment Controller

**File: `backend/src/risk-assessment.controller.ts`**

```typescript
import { Controller, Post, Get, Body, Param, Query } from '@nestjs/common';
import { RiskAssessmentService } from './risk-assessment.service';

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

@Controller('risk-assessment')
export class RiskAssessmentController {
  constructor(private readonly riskService: RiskAssessmentService) {}

  @Post('analyze')
  async analyzeRisk(@Body() profile: DriverProfileDto) {
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
```

### Step 1.4: Add Risk Assessment Service

**File: `backend/src/risk-assessment.service.ts`**

```typescript
import { Injectable } from '@nestjs/common';
import { IoTIntegrationService } from './iot-integration.service';
import { PricingEngineService } from './pricing-engine.service';

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

  constructor(
    private iotService: IoTIntegrationService,
    private pricingEngine: PricingEngineService,
  ) {}

  async calculateRiskScore(profile: any): Promise<RiskScoreDto> {
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
    const riskCategory = this.getRiskCategory(riskScore);
    const basePremium = 50000;
    const adjustedPremium = this.pricingEngine.calculatePremium(riskScore, basePremium);
    const discount = Math.max(0, basePremium - adjustedPremium);

    return {
      driverId: profile.driverId,
      riskScore,
      riskCategory,
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
```

### Step 1.5: Add IoT Integration Service

**File: `backend/src/iot-integration.service.ts`**

```typescript
import { Injectable } from '@nestjs/common';

@Injectable()
export class IoTIntegrationService {
  async fetchDeviceData(deviceId: string) {
    // Mock OBD-II device data for POC
    return {
      deviceId,
      timestamp: new Date(),
      metrics: {
        speed: Math.floor(Math.random() * 100),
        rpm: Math.floor(Math.random() * 5000),
        fuel: Math.floor(Math.random() * 100),
        engineTemp: 85 + Math.floor(Math.random() * 20),
        harshBraking: Math.floor(Math.random() * 5),
        harshAcceleration: Math.floor(Math.random() * 5),
        location: {
          lat: 35.6762 + (Math.random() - 0.5) * 0.1,
          lng: 139.6503 + (Math.random() - 0.5) * 0.1,
        },
      },
      status: 'active',
    };
  }
}
```

### Step 1.6: Add Pricing Engine Service

**File: `backend/src/pricing-engine.service.ts`**

```typescript
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
```

### Step 1.7: Update App Module

**Edit: `backend/src/app.module.ts`**

Replace the entire file with:

```typescript
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
```

### Step 1.8: Test Backend

```powershell
cd C:\Users\Edu\Documents\Chamba\AIG\OCR\PCO\backend
npm run start:dev
```

Test the endpoint:
```powershell
# Open another PowerShell window
curl http://localhost:3000/risk-assessment/iot/OBD-001/data
```

---

## 🎨 Part 2: Frontend Setup (Angular)

### Step 2.1: Create Directory Structure

```powershell
cd C:\Users\Edu\Documents\Chamba\AIG\OCR\PCO\frontend\src\app

# Create risk assessment folders
New-Item -ItemType Directory -Path "components\risk-assessment"
New-Item -ItemType Directory -Path "components\risk-assessment\risk-dashboard"
New-Item -ItemType Directory -Path "components\risk-assessment\iot-monitor"
New-Item -ItemType Directory -Path "services\risk-assessment"
```

### Step 2.2: Create Risk Assessment Service

**File: `frontend/src/app/services/risk-assessment/risk-assessment.service.ts`**

```typescript
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
```

### Step 2.3: Create Risk Dashboard Component (TypeScript)

**File: `frontend/src/app/components/risk-assessment/risk-dashboard/risk-dashboard.component.ts`**

Copy the complete TypeScript code from my second artifact (RiskDashboardComponent).

### Step 2.4: Create Risk Dashboard Component (HTML)

**File: `frontend/src/app/components/risk-assessment/risk-dashboard/risk-dashboard.component.html`**

Copy the complete HTML code from my second artifact.

### Step 2.5: Create Risk Dashboard Component (SCSS)

**File: `frontend/src/app/components/risk-assessment/risk-dashboard/risk-dashboard.component.scss`**

Copy the complete SCSS code from my second artifact.

### Step 2.6: Create IoT Monitor Component (TypeScript)

**File: `frontend/src/app/components/risk-assessment/iot-monitor/iot-monitor.component.ts`**

Copy the complete TypeScript code from my IoT Monitor artifact.

### Step 2.7: Create IoT Monitor Component (HTML)

**File: `frontend/src/app/components/risk-assessment/iot-monitor/iot-monitor.component.html`**

Copy the complete HTML code from my IoT Monitor artifact.

### Step 2.8: Create IoT Monitor Component (SCSS)

**File: `frontend/src/app/components/risk-assessment/iot-monitor/iot-monitor.component.scss`**

Copy the complete SCSS code from my IoT Monitor artifact.

### Step 2.9: Update Routes

**Edit: `frontend/src/app/app.routes.ts`**

```typescript
import { Routes } from '@angular/router';
import { ImageUploaderComponent } from './components/image-uploader/image-uploader.component';
import { HomeComponent } from './components/home.component';
import { RiskDashboardComponent } from './components/risk-assessment/risk-dashboard/risk-dashboard.component';
import { IoTMonitorComponent } from './components/risk-assessment/iot-monitor/iot-monitor.component';

export const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'OCRAuto', component: ImageUploaderComponent },
  { path: 'risk-assessment', component: RiskDashboardComponent },
  { path: 'risk-assessment/iot-monitor', component: IoTMonitorComponent },
];
```

### Step 2.10: Update Home Component (Add Navigation)

**Edit: `frontend/src/app/components/home.component.ts`**

```typescript
import { Component } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-home',
  standalone: true,
  template: `
    <div class="home-container">
      <h1>Welcome to the Insurance Portal</h1>
      <p class="subtitle">Manage OCR processing and risk assessments.</p>
      <div class="button-group">
        <button class="go-btn" (click)="goToOcr()">OCR Auto</button>
        <button class="go-btn risk-btn" (click)="goToRisk()">Risk Assessment</button>
      </div>
    </div>
  `,
  styles: [`
    .home-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 70vh;
      background: #f8f9fa;
      border-radius: 16px;
      box-shadow: 0 2px 16px rgba(0,0,0,0.08);
      margin: 2rem auto;
      max-width: 600px;
      padding: 2.5rem 2rem;
    }
    h1 {
      font-size: 2.2rem;
      margin-bottom: 1.2rem;
      color: #007bff;
    }
    .subtitle {
      font-size: 1.2rem;
      color: #333;
      margin-bottom: 2.5rem;
    }
    .button-group {
      display: flex;
      gap: 1rem;
      flex-wrap: wrap;
      justify-content: center;
    }
    .go-btn {
      background: #007bff;
      color: #fff;
      border: none;
      border-radius: 6px;
      font-size: 1.1rem;
      padding: 0.9rem 2.2rem;
      cursor: pointer;
      font-weight: 500;
      transition: background 0.2s;
    }
    .go-btn:hover {
      background: #0056b3;
    }
    .risk-btn {
      background: #28a745;
    }
    .risk-btn:hover {
      background: #218838;
    }
  `]
})
export class HomeComponent {
  constructor(private router: Router) {}
  
  goToOcr() {
    this.router.navigate(['/OCRAuto']);
  }
  
  goToRisk() {
    this.router.navigate(['/risk-assessment']);
  }
}
```

---

## 🧪 Part 3: Testing the Integration

### Step 3.1: Start Backend
```powershell
cd C:\Users\Edu\Documents\Chamba\AIG\OCR\PCO\backend
npm run start:dev
```

### Step 3.2: Start Frontend
```powershell
cd C:\Users\Edu\Documents\Chamba\AIG\OCR\PCO\frontend
ng serve
```

### Step 3.3: Test the Features

1. **Navigate to Home**
   - Go to `http://localhost:4200`
   - You should see 2 buttons: "OCR Auto" and "Risk Assessment"

2. **Test Risk Assessment Dashboard**
   - Click "Risk Assessment" button
   - You should see 3 sample Japanese drivers
   - Click on any driver to analyze their risk

3. **Test IoT Monitor**
   - Click "リアルタイムモニタリング" button
   - Click "モニタリング開始" to start real-time monitoring
   - Watch metrics update every 3 seconds

---

## 📁 Final File Structure

```
PCO/
├── frontend/src/app/
│   ├── components/
│   │   ├── home.component.ts (✅ UPDATED)
│   │   ├── image-uploader/ (✅ EXISTING)
│   │   └── risk-assessment/ (✨ NEW)
│   │       ├── risk-dashboard/
│   │       │   ├── risk-dashboard.component.ts
│   │       │   ├── risk-dashboard.component.html
│   │       │   └── risk-dashboard.component.scss
│   │       └── iot-monitor/
│   │           ├── iot-monitor.component.ts
│   │           ├── iot-monitor.component.html
│   │           └── iot-monitor.component.scss
│   ├── services/
│   │   ├── ocr.service.ts (✅ EXISTING)
│   │   └── risk-assessment/ (✨ NEW)
│   │       └── risk-assessment.service.ts
│   ├── app.routes.ts (✅ UPDATED)
│   └── ... (other existing files)
│
└── backend/src/
    ├── app.controller.ts (✅ EXISTING)
    ├── app.service.ts (✅ EXISTING)
    ├── app.module.ts (✅ UPDATED)
    ├── main.ts (✅ EXISTING)
    ├── risk-assessment.controller.ts (✨ NEW)
    ├── risk-assessment.service.ts (✨ NEW)
    ├── iot-integration.service.ts (✨ NEW)
    └── pricing-engine.service.ts (✨ NEW)
```

---

## ✅ Integration Checklist

- [ ] Backend: Created 4 new service files
- [ ] Backend: Updated app.module.ts
- [ ] Backend: Server running on port 3000
- [ ] Backend: Test endpoint working (`curl http://localhost:3000/risk-assessment/iot/OBD-001/data`)
- [ ] Frontend: Created risk-assessment service
- [ ] Frontend: Created risk-dashboard component (3 files)
- [ ] Frontend: Created iot-monitor component (3 files)
- [ ] Frontend: Updated app.routes.ts
- [ ] Frontend: Updated home.component.ts
- [ ] Frontend: Server running on port 4200
- [ ] Can navigate to home page
- [ ] Can see both buttons on home page
- [ ] Can access Risk Assessment dashboard
- [ ] Can click on drivers
- [ ] Can access IoT Monitor
- [ ] Can start monitoring

---

## 🚀 Next Steps

1. **Integrate with OCR Data**
   - Link OCR extracted data to risk assessment
   - Extract driver age, vehicle type from OCR results
   - Auto-calculate risk based on policy data

2. **Real IoT Integration**
   - Replace mock data with actual OBD-II API
   - Implement WebSocket for real-time updates

3. **Database Integration**
   - Store driver profiles
   - Track historical risk scores
   - Save IoT metrics

---

## 🐛 Troubleshooting

### CORS Error
Already handled in your `main.ts` ✅

### Component Not Found
Make sure all components are declared as `standalone: true` ✅

### Service Not Found
All services use `providedIn: 'root'` - no additional registration needed ✅

---

**You're all set! Your POC integrates seamlessly with your existing OCR project. Both features work independently and can be enhanced together in the future.** 🎉