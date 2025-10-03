import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { RiskAssessmentService } from '../../../services/risk-assessment/risk-assessment.service';
import { interval, Subscription } from 'rxjs';
import { switchMap } from 'rxjs/operators';

interface IoTMetrics {
  speed: number;
  rpm: number;
  fuel: number;
  engineTemp: number;
  harshBraking: number;
  harshAcceleration: number;
  location: { lat: number; lng: number };
}

@Component({
  selector: 'app-iot-monitor',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './iot-monitor.component.html',
  styleUrls: ['./iot-monitor.component.scss']
})
export class IoTMonitorComponent implements OnInit, OnDestroy {
  deviceId = 'OBD-001';
  currentMetrics: IoTMetrics | null = null;
  metricsHistory: IoTMetrics[] = [];
  isMonitoring = false;
  private subscription: Subscription | null = null;

  alerts: Array<{ type: string; message: string; timestamp: Date }> = [];
  safetyScore = 85;
  tripDistance = 0;
  tripDuration = 0;

  constructor(private riskService: RiskAssessmentService, private router: Router) {}

  ngOnInit() {
    this.loadInitialData();
  }

  ngOnDestroy() {
    this.stopMonitoring();
  }

  loadInitialData() {
    this.riskService.getIoTData(this.deviceId).subscribe({
      next: (data) => {
        this.currentMetrics = data.metrics;
        this.metricsHistory.push(data.metrics);
      },
      error: (err) => console.error('Failed to load IoT data:', err)
    });
  }

  startMonitoring() {
    this.isMonitoring = true;
    this.subscription = interval(3000)
      .pipe(
        switchMap(() => this.riskService.getIoTData(this.deviceId))
      )
      .subscribe({
        next: (data) => {
          this.currentMetrics = data.metrics;
          this.metricsHistory.push(data.metrics);
          
          if (this.metricsHistory.length > 20) {
            this.metricsHistory.shift();
          }

          this.checkForAlerts(data.metrics);
          this.updateTripStats();
        },
        error: (err) => {
          console.error('Monitoring error:', err);
          this.stopMonitoring();
        }
      });
  }

  stopMonitoring() {
    this.isMonitoring = false;
    if (this.subscription) {
      this.subscription.unsubscribe();
      this.subscription = null;
    }
  }

  checkForAlerts(metrics: IoTMetrics) {
    if (metrics.speed > 100) {
      this.addAlert('warning', `High speed detected: ${metrics.speed} km/h`);
    }

    if (metrics.engineTemp > 100) {
      this.addAlert('danger', `High engine temperature: ${metrics.engineTemp}°C`);
    }

    if (metrics.harshBraking > 3) {
      this.addAlert('warning', 'Sudden braking detected');
      this.safetyScore = Math.max(0, this.safetyScore - 2);
    }

    if (metrics.harshAcceleration > 3) {
      this.addAlert('warning', 'Sudden acceleration detected');
      this.safetyScore = Math.max(0, this.safetyScore - 1);
    }
  }

  addAlert(type: string, message: string) {
    this.alerts.unshift({ type, message, timestamp: new Date() });
    
    if (this.alerts.length > 10) {
      this.alerts.pop();
    }
  }

  updateTripStats() {
    this.tripDuration += 3;
    
    if (this.metricsHistory.length > 1) {
      const lastMetric = this.metricsHistory[this.metricsHistory.length - 1];
      this.tripDistance += (lastMetric.speed * 3) / 3600;
    }
  }

  getSpeedColor(): string {
    if (!this.currentMetrics) return '#6b7280';
    const speed = this.currentMetrics.speed;
    if (speed > 100) return '#ef4444';
    if (speed > 80) return '#f59e0b';
    return '#10b981';
  }

  getRpmColor(): string {
    if (!this.currentMetrics) return '#6b7280';
    const rpm = this.currentMetrics.rpm;
    if (rpm > 4000) return '#ef4444';
    if (rpm > 3000) return '#f59e0b';
    return '#10b981';
  }

  getEngineColor(): string {
    if (!this.currentMetrics) return '#6b7280';
    const temp = this.currentMetrics.engineTemp;
    if (temp > 100) return '#ef4444';
    if (temp > 95) return '#f59e0b';
    return '#10b981';
  }

  getSafetyColor(): string {
    if (this.safetyScore >= 80) return '#10b981';
    if (this.safetyScore >= 60) return '#f59e0b';
    return '#ef4444';
  }

  formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  getAlertIcon(type: string): string {
    return type === 'danger' ? '🚨' : '⚠️';
  }

  resetTrip() {
    this.tripDistance = 0;
    this.tripDuration = 0;
    this.safetyScore = 85;
    this.metricsHistory = [];
    this.alerts = [];
  }

  returnHome() {
    this.router.navigate(['/']);
  }
}