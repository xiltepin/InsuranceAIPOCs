import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { environment } from '../../../environments/environment';

const API = `${environment.apiUrl}/api/rating`;

interface PredictResponse {
  risk_tier: string;
  risk_probabilities: Record<string, number>;
  annual_premium: number;
  monthly_premium: number;
}

interface ModelInfo {
  training_samples: number;
  feature_names: string[];
  metrics: {
    classification: { accuracy: number };
    regression: { mae: number; rmse: number; r2: number };
  };
  feature_importance: {
    classification: Record<string, number>;
    regression: Record<string, number>;
  };
}

@Component({
  selector: 'app-rating-engine',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule],
  template: `
<div class="rating-container">

  <!-- Header -->
  <div class="re-header">
    <h1>Auto Insurance Rating Engine</h1>
    <p class="subtitle">Random Forest · Risk classification + premium estimation</p>
    <div class="status-row">
      <span class="status-dot" [class.ready]="modelReady" [class.not-ready]="!modelReady"></span>
      <span>{{ modelReady ? 'Model ready' : 'Model not trained' }}</span>
      <button class="btn-secondary" (click)="trainModel()" [disabled]="training">
        {{ training ? 'Training...' : '⟳ Train / Retrain' }}
      </button>
    </div>
    <div *ngIf="trainResult" class="train-result">
      Trained on {{ trainResult.training_samples | number }} policies ·
      Accuracy {{ (trainResult.classification_accuracy * 100).toFixed(1) }}% ·
      Premium R² {{ trainResult.regression_r2.toFixed(3) }} · MAE \${{ trainResult.regression_mae | number:'1.2-2' }}
    </div>
  </div>

  <div class="two-col">

    <!-- FORM -->
    <div class="card form-card">
      <h2>Policy details</h2>

      <div class="section-label">Driver</div>
      <div class="form-grid">
        <label>Age
          <input type="number" [(ngModel)]="form.age" min="18" max="80">
        </label>
        <label>Driving experience (yrs)
          <input type="number" [(ngModel)]="form.driving_experience" min="0" max="60">
        </label>
        <label>Accidents (5 yrs)
          <input type="number" [(ngModel)]="form.num_accidents" min="0" max="5">
        </label>
        <label>Violations (5 yrs)
          <input type="number" [(ngModel)]="form.num_violations" min="0" max="5">
        </label>
        <label>Credit score
          <input type="number" [(ngModel)]="form.credit_score" min="300" max="850">
        </label>
        <label>Marital status
          <select [(ngModel)]="form.marital_status">
            <option value="single">Single</option>
            <option value="married">Married</option>
            <option value="divorced">Divorced</option>
          </select>
        </label>
      </div>

      <div class="section-label">Vehicle</div>
      <div class="form-grid">
        <label>Vehicle type
          <select [(ngModel)]="form.vehicle_type">
            <option value="sedan">Sedan</option>
            <option value="suv">SUV</option>
            <option value="truck">Truck</option>
            <option value="sports">Sports</option>
            <option value="minivan">Minivan</option>
          </select>
        </label>
        <label>Vehicle age (yrs)
          <input type="number" [(ngModel)]="form.vehicle_age" min="0" max="25">
        </label>
        <label>Annual mileage (km)
          <input type="number" [(ngModel)]="form.annual_mileage" min="3000" max="50000">
        </label>
        <label>Safety rating (1–5)
          <input type="number" [(ngModel)]="form.safety_rating" min="1" max="5">
        </label>
      </div>

      <div class="section-label">Policy</div>
      <div class="form-grid">
        <label>Location risk
          <select [(ngModel)]="form.location_risk">
            <option value="rural">Rural</option>
            <option value="suburban">Suburban</option>
            <option value="urban">Urban</option>
          </select>
        </label>
        <label>Coverage type
          <select [(ngModel)]="form.coverage_type">
            <option value="liability">Liability</option>
            <option value="comprehensive">Comprehensive</option>
            <option value="full">Full</option>
          </select>
        </label>
      </div>

      <button class="btn-primary" (click)="predict()" [disabled]="!modelReady || loading">
        {{ loading ? 'Calculating...' : 'Calculate rate' }}
      </button>
      <div *ngIf="errorMsg" class="error-msg">{{ errorMsg }}</div>
    </div>

    <!-- RESULTS -->
    <div class="right-col">

      <div class="card result-card" *ngIf="result">
        <h2>Rating result</h2>

        <div class="tier-badge" [ngClass]="getTierClass()">
          {{ result.risk_tier }} Risk
        </div>

        <div class="premium-row">
          <div class="premium-block">
            <span class="premium-label">Annual premium</span>
            <span class="premium-value">\${{ result.annual_premium | number:'1.2-2' }}</span>
          </div>
          <div class="premium-block">
            <span class="premium-label">Monthly</span>
            <span class="premium-value">\${{ result.monthly_premium | number:'1.2-2' }}</span>
          </div>
        </div>

        <div class="prob-section">
          <div class="prob-label">Risk probability breakdown</div>
          <div class="prob-bars">
            <div *ngFor="let tier of tierOrder" class="prob-row">
              <span class="prob-name">{{ tier }}</span>
              <div class="prob-bar-wrap">
                <div class="prob-bar" [ngClass]="getTierBarClass(tier)"
                     [style.width.%]="(result.risk_probabilities[tier] || 0) * 100"></div>
              </div>
              <span class="prob-pct">{{ ((result.risk_probabilities[tier] || 0) * 100).toFixed(1) }}%</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Model info / feature importance -->
      <div class="card info-card" *ngIf="modelInfo">
        <h2>Model metrics</h2>
        <div class="metrics-grid">
          <div class="metric"><span class="metric-label">Accuracy</span><span class="metric-val">{{ (modelInfo.metrics.classification.accuracy * 100).toFixed(1) }}%</span></div>
          <div class="metric"><span class="metric-label">Premium R²</span><span class="metric-val">{{ modelInfo.metrics.regression.r2.toFixed(3) }}</span></div>
          <div class="metric"><span class="metric-label">Premium MAE</span><span class="metric-val">\${{ modelInfo.metrics.regression.mae | number:'1.0-0' }}</span></div>
          <div class="metric"><span class="metric-label">Training set</span><span class="metric-val">{{ modelInfo.training_samples | number }}</span></div>
        </div>

        <div class="fi-section">
          <div class="fi-label">Top risk factors (classification importance)</div>
          <div *ngFor="let f of topFeatures" class="fi-row">
            <span class="fi-name">{{ f.name }}</span>
            <div class="fi-bar-wrap">
              <div class="fi-bar" [style.width.%]="f.pct"></div>
            </div>
            <span class="fi-pct">{{ f.pct.toFixed(1) }}%</span>
          </div>
        </div>
      </div>

    </div>
  </div>
</div>
  `,
  styles: [`
    .rating-container { max-width: 1100px; margin: 0 auto; padding: 24px 16px; font-family: sans-serif; color: #1a1a1a; }
    .re-header { margin-bottom: 24px; }
    .re-header h1 { font-size: 22px; font-weight: 600; margin: 0 0 4px; }
    .subtitle { color: #666; font-size: 14px; margin: 0 0 12px; }
    .status-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
    .status-dot { width: 10px; height: 10px; border-radius: 50%; background: #ccc; }
    .status-dot.ready { background: #1D9E75; }
    .status-dot.not-ready { background: #E24B4A; }
    .train-result { margin-top: 8px; font-size: 13px; color: #444; background: #f0fdf6; border-left: 3px solid #1D9E75; padding: 8px 12px; border-radius: 4px; }

    .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
    @media (max-width: 700px) { .two-col { grid-template-columns: 1fr; } }

    .card { background: #fff; border: 1px solid #e5e5e5; border-radius: 12px; padding: 20px; }
    .card h2 { font-size: 16px; font-weight: 600; margin: 0 0 16px; }
    .right-col { display: flex; flex-direction: column; gap: 16px; }

    .section-label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: #888; margin: 12px 0 8px; }
    .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    label { display: flex; flex-direction: column; font-size: 13px; color: #555; gap: 4px; }
    input, select { border: 1px solid #ddd; border-radius: 6px; padding: 7px 10px; font-size: 14px; background: #fafafa; outline: none; }
    input:focus, select:focus { border-color: #1D9E75; background: #fff; }

    .btn-primary { margin-top: 18px; width: 100%; padding: 11px; background: #1D9E75; color: #fff; border: none; border-radius: 8px; font-size: 15px; font-weight: 500; cursor: pointer; }
    .btn-primary:hover:not(:disabled) { background: #0F6E56; }
    .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn-secondary { padding: 7px 14px; background: #f5f5f5; border: 1px solid #ddd; border-radius: 6px; font-size: 13px; cursor: pointer; }
    .btn-secondary:hover:not(:disabled) { background: #eee; }
    .btn-secondary:disabled { opacity: 0.5; }
    .error-msg { margin-top: 10px; color: #E24B4A; font-size: 13px; }

    .tier-badge { display: inline-block; padding: 8px 18px; border-radius: 20px; font-weight: 700; font-size: 18px; margin-bottom: 16px; }
    .tier-low { background: #E1F5EE; color: #085041; }
    .tier-medium { background: #FAEEDA; color: #633806; }
    .tier-high { background: #FAECE7; color: #712B13; }
    .tier-very-high { background: #FCEBEB; color: #501313; }

    .premium-row { display: flex; gap: 16px; margin-bottom: 18px; }
    .premium-block { flex: 1; background: #f8f8f8; border-radius: 8px; padding: 12px; text-align: center; }
    .premium-label { display: block; font-size: 12px; color: #888; margin-bottom: 4px; }
    .premium-value { font-size: 22px; font-weight: 700; color: #1a1a1a; }

    .prob-label, .fi-label { font-size: 12px; font-weight: 600; color: #888; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 10px; }
    .prob-row, .fi-row { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; font-size: 13px; }
    .prob-name, .fi-name { width: 90px; font-size: 12px; color: #555; text-align: right; flex-shrink: 0; }
    .fi-name { width: 130px; text-align: right; }
    .prob-bar-wrap, .fi-bar-wrap { flex: 1; background: #f0f0f0; border-radius: 4px; height: 10px; overflow: hidden; }
    .prob-bar, .fi-bar { height: 100%; border-radius: 4px; transition: width 0.4s ease; }
    .prob-bar { background: #5DCAA5; }
    .tier-bar-low { background: #1D9E75; }
    .tier-bar-medium { background: #EF9F27; }
    .tier-bar-high { background: #D85A30; }
    .tier-bar-very-high { background: #E24B4A; }
    .fi-bar { background: #5F5E5A; }
    .prob-pct, .fi-pct { width: 40px; font-size: 12px; color: #888; text-align: right; }

    .metrics-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 16px; }
    .metric { background: #f8f8f8; border-radius: 8px; padding: 10px 12px; }
    .metric-label { display: block; font-size: 11px; color: #888; }
    .metric-val { font-size: 18px; font-weight: 700; color: #1a1a1a; }
    .fi-section { margin-top: 4px; }
  `],
})
export class RatingEngineComponent implements OnInit {
  form = {
    age: 35,
    driving_experience: 15,
    num_accidents: 0,
    num_violations: 0,
    credit_score: 700,
    marital_status: 'married',
    vehicle_age: 3,
    vehicle_type: 'sedan',
    annual_mileage: 15000,
    safety_rating: 4,
    location_risk: 'suburban',
    coverage_type: 'comprehensive',
  };

  result: PredictResponse | null = null;
  modelInfo: ModelInfo | null = null;
  topFeatures: { name: string; pct: number }[] = [];
  tierOrder = ['Low', 'Medium', 'High', 'Very High'];

  modelReady = false;
  loading = false;
  training = false;
  trainResult: any = null;
  errorMsg = '';

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.checkHealth();
  }

  getTierClass(): string {
    if (!this.result) return '';
    return 'tier-' + this.result.risk_tier.toLowerCase().replace(' ', '-');
  }

  getTierBarClass(tier: string): string {
    return 'tier-bar-' + tier.toLowerCase().replace(' ', '-');
  }

  checkHealth() {
    this.http.get<{ model_ready: boolean }>(`${API}/health`).subscribe({
      next: (r) => {
        this.modelReady = r.model_ready;
        if (this.modelReady) this.fetchModelInfo();
      },
      error: () => { this.modelReady = false; },
    });
  }

  trainModel() {
    this.training = true;
    this.trainResult = null;
    this.http.post<any>(`${API}/train`, {}).subscribe({
      next: (r) => {
        this.trainResult = r;
        this.modelReady = true;
        this.training = false;
        this.fetchModelInfo();
      },
      error: () => { this.training = false; },
    });
  }

  predict() {
    this.loading = true;
    this.errorMsg = '';
    this.http.post<PredictResponse>(`${API}/predict`, this.form).subscribe({
      next: (r) => { this.result = r; this.loading = false; },
      error: (e) => {
        this.errorMsg = e.error?.detail || 'Prediction failed';
        this.loading = false;
      },
    });
  }

  fetchModelInfo() {
    this.http.get<ModelInfo>(`${API}/model/info`).subscribe({
      next: (info) => {
        this.modelInfo = info;
        const imp = info.feature_importance.classification;
        const total = Object.values(imp).reduce((a: number, b: number) => a + b, 0);
        this.topFeatures = Object.entries(imp)
          .map(([name, val]) => ({ name, pct: (val / total) * 100 }))
          .sort((a, b) => b.pct - a.pct)
          .slice(0, 8);
      },
    });
  }
}
