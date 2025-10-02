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