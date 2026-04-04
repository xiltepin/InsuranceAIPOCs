import { Component, OnInit, NgZone, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { environment } from '../../../environments/environment';

const API = `${environment.apiUrl}/api/rating`;

interface HybridResult {
  mode: string;
  risk_tier: string;
  risk_probabilities: Record<string, number>;
  rf_confidence?: number;
  excel_premium_jpy?: number;
  rf_premium_jpy?: number;
  annual_premium_jpy: number;
  monthly_premium_jpy: number;
  excel_breakdown?: {
    bi_premium: number;
    pd_premium: number;
    vehicle_premium: number;
    passenger_premium: number;
    ncd_grade: number;
    vehicle_class: number;
  };
  blend_weights?: { excel: number; rf: number };
}

interface ModelInfo {
  training_samples: number;
  trained_with_excel: boolean;
  excel_loaded: boolean;
  training_source?: string;
  feature_names: string[];
  metrics: {
    classification: { accuracy: number };
    regression: { mae: number; r2: number };
  };
  feature_importance: {
    classification: Record<string, number>;
    regression: Record<string, number>;
  };
}

interface HealthStatus {
  model_ready: boolean;
  excel_loaded: boolean;
}

interface DbStatus {
  available: boolean;
  total_rows: number;
  message: string;
}

interface TrainResult {
  message: string;
  training_samples: number;
  training_source: string;
  classification_accuracy: number;
  regression_r2: number;
  regression_mae_jpy: number;
}

@Component({
  selector: 'app-rating-engine',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule],
  template: `
<div class="re-wrap">

  <!-- ── Training result dialog ── -->
  <div class="dialog-backdrop" *ngIf="showTrainDialog" (click)="closeDialog()">
    <div class="dialog-box" (click)="$event.stopPropagation()">
      <div class="dialog-header">
        <span class="dialog-icon">✓</span>
        <h2>Random Forest training complete</h2>
      </div>

      <div class="dialog-section">
        <div class="dl-label">Source</div>
        <div class="dl-val source-pill">{{ trainResult?.training_source }}</div>
      </div>

      <div class="dialog-section">
        <div class="dl-label">Table trained from</div>
        <div class="dl-table-name">japan_auto_policies</div>
        <div class="dl-sub">PostgreSQL · insurance_poc database · {{ dbStatus.total_rows | number }} total rows available</div>
      </div>

      <div class="dialog-section">
        <div class="dl-label">Rows used for training</div>
        <div class="dl-val">{{ trainResult?.training_samples | number }}</div>
      </div>

      <div class="dialog-section">
        <div class="dl-label">Features fed into Random Forest ({{ rfFeatures.length }} columns)</div>
        <div class="feature-grid">
          <div class="feature-pill" *ngFor="let f of rfFeatures">
            <span class="feat-col">{{ f.col }}</span>
            <span class="feat-desc">{{ f.desc }}</span>
          </div>
        </div>
      </div>

      <div class="dialog-section">
        <div class="dl-label">RF targets learned</div>
        <div class="target-row">
          <div class="target-block clf">
            <span class="tgt-name">Classifier → risk_tier</span>
            <span class="tgt-metric">Accuracy {{ ((trainResult?.classification_accuracy ?? 0) * 100).toFixed(1) }}%</span>
          </div>
          <div class="target-block reg">
            <span class="tgt-name">Regressor → annual_premium_jpy</span>
            <span class="tgt-metric">R² {{ (trainResult?.regression_r2 ?? 0).toFixed(3) }} · MAE ¥{{ trainResult?.regression_mae_jpy | number:'1.0-0' }}</span>
          </div>
        </div>
      </div>

      <div class="dialog-section">
        <div class="dl-label">Two RF models stored in</div>
        <div class="dl-code">rating-engine/models/rf_artifacts.pkl</div>
        <div class="dl-sub">150 decision trees each · classifier + regressor · ~60 MB on disk</div>
      </div>

      <button class="btn-close-dialog" (click)="closeDialog()">Close</button>
    </div>
  </div>

  <!-- ── Header ── -->
  <div class="re-header">
    <h1>Japan Auto Insurance Rating Engine</h1>
    <p class="subtitle">
      自動車保険料率算定 &nbsp;·&nbsp; Hybrid: Excel Actuarial + Random Forest
    </p>

    <div class="status-bar">
      <span class="badge" [class.ok]="health.model_ready" [class.err]="!health.model_ready">
        RF {{ health.model_ready ? 'ready' : 'not trained' }}
      </span>
      <span class="badge" [class.ok]="health.excel_loaded" [class.err]="!health.excel_loaded">
        Excel {{ health.excel_loaded ? 'loaded' : 'not uploaded' }}
      </span>
      <span class="badge" [class.ok]="dbStatus.available" [class.err]="!dbStatus.available">
        DB {{ dbStatus.available ? (dbStatus.total_rows | number) + ' rows' : 'not connected' }}
      </span>

      <label class="btn-upload">
        <input type="file" accept=".xlsx" (change)="onExcelFile($event)" style="display:none">
        {{ uploading ? 'Uploading...' : '↑ Upload rating manual' }}
      </label>

      <button class="btn-train" (click)="trainModel()" [disabled]="training">
        {{ training ? 'Training...' : '⟳ Train / Retrain' }}
      </button>
    </div>

    <div *ngIf="uploadMsg" class="info-banner" [class.err-banner]="uploadErr">{{ uploadMsg }}</div>
  </div>

  <!-- ── Mode selector ── -->
  <div class="mode-row">
    <span class="mode-label">Prediction mode:</span>
    <label *ngFor="let m of modes" class="mode-opt">
      <input type="radio" [(ngModel)]="form.mode" [value]="m.key">
      <span class="mode-pill" [class.active]="form.mode === m.key">{{ m.label }}</span>
    </label>
    <span class="mode-desc">{{ modeDesc }}</span>
  </div>

  <div class="two-col">

    <!-- ── Form ── -->
    <div class="card">
      <h2>契約情報 — Policy details</h2>

      <div class="section-lbl">等級・年齢 — Grade &amp; age</div>
      <div class="form-grid">
        <label>NCD等級 / Grade
          <select [(ngModel)]="form.ncd_grade">
            <option *ngFor="let g of ncdGrades" [value]="g">
              等級{{ g }}{{ g === 6 ? ' (new driver)' : '' }}{{ g === 20 ? ' (max discount)' : '' }}
            </option>
          </select>
        </label>
        <label>年齢条件 / Age condition
          <select [(ngModel)]="form.age_condition">
            <option value="all">全年齢担保 (all ages)</option>
            <option value="21+">21歳以上担保</option>
            <option value="26+">26歳以上担保 (standard)</option>
            <option value="30+">30歳以上担保</option>
            <option value="35+">35歳以上担保</option>
          </select>
        </label>
        <label>運転者年齢 / Driver age
          <input type="number" [(ngModel)]="form.driver_age" min="18" max="75">
        </label>
        <label>免許取得年数 / Years licensed
          <input type="number" [(ngModel)]="form.years_licensed" min="0" max="57">
        </label>
        <label>事故件数 / Accidents (5yr)
          <input type="number" [(ngModel)]="form.num_accidents" min="0" max="4">
        </label>
        <label>違反件数 / Violations (5yr)
          <input type="number" [(ngModel)]="form.num_violations" min="0" max="3">
        </label>
      </div>

      <div class="section-lbl">車両・地域 — Vehicle &amp; location</div>
      <div class="form-grid">
        <label>都道府県 / Prefecture
          <select [(ngModel)]="form.prefecture_code">
            <option *ngFor="let p of prefectures" [value]="p.code">{{ p.code }} {{ p.name }}</option>
          </select>
        </label>
        <label>料率クラス / Vehicle class
          <select [(ngModel)]="form.vehicle_rating_class">
            <option *ngFor="let c of vehicleClasses" [value]="c.val">クラス {{ c.val }} — {{ c.label }}</option>
          </select>
        </label>
        <label>運転者限定 / Driver restriction
          <select [(ngModel)]="form.driver_restriction">
            <option value="none">限定なし (none)</option>
            <option value="family">家族限定 (family)</option>
            <option value="spouse">本人・配偶者 (spouse)</option>
            <option value="self">本人限定 (self only)</option>
          </select>
        </label>
        <label>年間走行距離 / Annual km
          <select [(ngModel)]="form.annual_km_band">
            <option value="〜5,000">〜5,000 km</option>
            <option value="5,001〜10,000">5,001〜10,000 km</option>
            <option value="10,001〜15,000">10,001〜15,000 km</option>
            <option value="15,001〜20,000">15,001〜20,000 km</option>
            <option value="20,001〜">20,001 km〜</option>
          </select>
        </label>
      </div>

      <button class="btn-primary" (click)="predict()" [disabled]="!canPredict || loading">
        {{ loading ? '計算中... Calculating...' : '保険料を算定する — Calculate premium' }}
      </button>
      <div *ngIf="errorMsg" class="error-msg">{{ errorMsg }}</div>
    </div>

    <!-- ── Results ── -->
    <div class="right-col">

      <div class="card result-card" *ngIf="result">
        <h2>算定結果 — Rating result
          <span class="mode-tag">{{ result.mode }}</span>
        </h2>
        <div class="tier-badge" [class]="tierClass(result.risk_tier)">{{ result.risk_tier }} Risk</div>
        <div class="premium-row">
          <div class="premium-block">
            <span class="prem-lbl">年間保険料 Annual</span>
            <span class="prem-val">¥{{ result.annual_premium_jpy | number:'1.0-0' }}</span>
          </div>
          <div class="premium-block">
            <span class="prem-lbl">月払概算 Monthly</span>
            <span class="prem-val">¥{{ result.monthly_premium_jpy | number:'1.0-0' }}</span>
          </div>
        </div>
        <div class="hybrid-row" *ngIf="result.mode === 'hybrid'">
          <div class="hybrid-block excel-block">
            <span class="hb-lbl">Excel actuarial</span>
            <span class="hb-val">¥{{ result.excel_premium_jpy | number:'1.0-0' }}</span>
            <span class="hb-weight">weight {{ ((result.blend_weights?.excel || 0) * 100).toFixed(0) }}%</span>
          </div>
          <div class="blend-arrow">⟶</div>
          <div class="hybrid-block rf-block">
            <span class="hb-lbl">Random Forest</span>
            <span class="hb-val">¥{{ result.rf_premium_jpy | number:'1.0-0' }}</span>
            <span class="hb-weight">weight {{ ((result.blend_weights?.rf || 0) * 100).toFixed(0) }}% · confidence {{ ((result.rf_confidence || 0) * 100).toFixed(0) }}%</span>
          </div>
        </div>
        <div class="breakdown" *ngIf="result.excel_breakdown">
          <div class="bd-lbl">Coverage breakdown (NCD等級{{ result.excel_breakdown.ncd_grade }} · クラス{{ result.excel_breakdown.vehicle_class }})</div>
          <div class="bd-row" *ngFor="let item of breakdownRows()">
            <span class="bd-name">{{ item.name }}</span>
            <span class="bd-val">¥{{ item.val | number:'1.0-0' }}</span>
          </div>
        </div>
        <div class="prob-section">
          <div class="prob-lbl">Risk probability — RF classifier</div>
          <div *ngFor="let tier of tierOrder" class="prob-row">
            <span class="prob-name">{{ tier }}</span>
            <div class="prob-bar-wrap">
              <div class="prob-bar" [class]="'pb-' + tier.toLowerCase().replace(' ','-')"
                   [style.width.%]="(result.risk_probabilities[tier] || 0) * 100"></div>
            </div>
            <span class="prob-pct">{{ ((result.risk_probabilities[tier] || 0) * 100).toFixed(1) }}%</span>
          </div>
        </div>
      </div>

      <div class="card" *ngIf="modelInfo">
        <h2>モデル情報 — Model metrics</h2>
        <div class="metrics-grid">
          <div class="metric"><span class="m-lbl">Accuracy</span><span class="m-val">{{ (modelInfo.metrics.classification.accuracy * 100).toFixed(1) }}%</span></div>
          <div class="metric"><span class="m-lbl">Premium R²</span><span class="m-val">{{ modelInfo.metrics.regression.r2.toFixed(3) }}</span></div>
          <div class="metric"><span class="m-lbl">Premium MAE</span><span class="m-val">¥{{ modelInfo.metrics.regression.mae | number:'1.0-0' }}</span></div>
          <div class="metric"><span class="m-lbl">Training set</span><span class="m-val">{{ modelInfo.training_samples | number }}</span></div>
          <div class="metric"><span class="m-lbl">Source</span><span class="m-val">{{ modelInfo.training_source || 'synthetic' }}</span></div>
          <div class="metric"><span class="m-lbl">Features</span><span class="m-val">{{ modelInfo.feature_names.length }}</span></div>
        </div>
        <div class="fi-lbl">Top risk factors (classification importance)</div>
        <div *ngFor="let f of topFeatures" class="fi-row">
          <span class="fi-name">{{ f.name }}</span>
          <div class="fi-bar-wrap"><div class="fi-bar" [style.width.%]="f.pct"></div></div>
          <span class="fi-pct">{{ f.pct.toFixed(1) }}%</span>
        </div>
      </div>

    </div>
  </div>
</div>
  `,
  styles: [`
    .re-wrap { max-width:1140px; margin:0 auto; padding:24px 16px; font-family:sans-serif; color:var(--color-text-primary); }
    .re-header { margin-bottom:20px; }
    .re-header h1 { font-size:22px; font-weight:700; margin:0 0 4px; }
    .subtitle { font-size:13px; color:var(--color-text-secondary); margin:0 0 14px; }
    .status-bar { display:flex; align-items:center; gap:10px; flex-wrap:wrap; margin-bottom:8px; }
    .badge { font-size:12px; padding:4px 10px; border-radius:12px; font-weight:600; }
    .badge.ok  { background:#E1F5EE; color:#085041; }
    .badge.err { background:#FCEBEB; color:#501313; }
    .btn-upload { padding:6px 14px; background:#E6F1FB; border:1px solid #85B7EB; border-radius:6px; font-size:13px; cursor:pointer; color:#0C447C; font-weight:500; }
    .btn-upload:hover { background:#B5D4F4; }
    .btn-train { padding:6px 14px; background:#1F4E79; color:#fff; border:none; border-radius:6px; font-size:13px; font-weight:600; cursor:pointer; }
    .btn-train:hover:not(:disabled) { background:#0C447C; }
    .btn-train:disabled { opacity:.5; }
    .info-banner { font-size:13px; background:#E1F5EE; border-left:3px solid #1D9E75; padding:8px 12px; border-radius:4px; margin-top:6px; color:#085041; }
    .info-banner.err-banner { background:#FCEBEB; border-color:#E24B4A; color:#501313; }

    /* dialog */
    .dialog-backdrop { position:fixed; inset:0; background:rgba(0,0,0,0.5); z-index:1000; display:flex; align-items:center; justify-content:center; padding:16px; }
    .dialog-box { background:var(--color-background-primary); border-radius:16px; padding:28px; max-width:640px; width:100%; max-height:90vh; overflow-y:auto; }
    .dialog-header { display:flex; align-items:center; gap:12px; margin-bottom:20px; }
    .dialog-icon { width:36px; height:36px; background:#E1F5EE; color:#085041; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:18px; font-weight:700; flex-shrink:0; }
    .dialog-header h2 { font-size:17px; font-weight:700; margin:0; }
    .dialog-section { margin-bottom:18px; }
    .dl-label { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.07em; color:var(--color-text-secondary); margin-bottom:6px; }
    .dl-val { font-size:20px; font-weight:700; }
    .source-pill { display:inline-block; background:#EEEDFE; color:#3C3489; padding:4px 14px; border-radius:12px; font-size:14px; font-weight:600; }
    .dl-table-name { font-size:15px; font-weight:700; font-family:monospace; background:var(--color-background-secondary); padding:6px 12px; border-radius:6px; display:inline-block; margin-bottom:4px; }
    .dl-sub { font-size:12px; color:var(--color-text-secondary); margin-top:4px; }
    .dl-code { font-size:13px; font-family:monospace; background:var(--color-background-secondary); padding:6px 12px; border-radius:6px; display:inline-block; }
    .feature-grid { display:flex; flex-wrap:wrap; gap:6px; margin-top:4px; }
    .feature-pill { background:var(--color-background-secondary); border:1px solid var(--color-border-tertiary); border-radius:8px; padding:5px 10px; font-size:12px; }
    .feat-col { font-weight:700; font-family:monospace; margin-right:4px; }
    .feat-desc { color:var(--color-text-secondary); }
    .target-row { display:flex; gap:10px; flex-wrap:wrap; }
    .target-block { flex:1; border-radius:8px; padding:10px 14px; min-width:180px; }
    .target-block.clf { background:#EEEDFE; border:1px solid #AFA9EC; }
    .target-block.reg { background:#EAF3DE; border:1px solid #97C459; }
    .tgt-name { display:block; font-size:13px; font-weight:600; margin-bottom:4px; }
    .tgt-metric { display:block; font-size:12px; color:var(--color-text-secondary); }
    .btn-close-dialog { margin-top:8px; width:100%; padding:11px; background:#1F4E79; color:#fff; border:none; border-radius:8px; font-size:14px; font-weight:600; cursor:pointer; }
    .btn-close-dialog:hover { background:#0C447C; }

    /* mode row */
    .mode-row { display:flex; align-items:center; gap:10px; flex-wrap:wrap; margin-bottom:20px; }
    .mode-label { font-size:13px; font-weight:600; color:var(--color-text-secondary); }
    .mode-opt { display:flex; align-items:center; gap:4px; cursor:pointer; }
    .mode-opt input { display:none; }
    .mode-pill { font-size:12px; padding:4px 12px; border-radius:12px; border:1px solid var(--color-border-secondary); color:var(--color-text-secondary); cursor:pointer; }
    .mode-pill.active { background:#1F4E79; color:#fff; border-color:#1F4E79; }
    .mode-desc { font-size:12px; color:var(--color-text-secondary); font-style:italic; }

    /* layout */
    .two-col { display:grid; grid-template-columns:1fr 1fr; gap:20px; }
    @media(max-width:720px){ .two-col { grid-template-columns:1fr; } }
    .card { background:var(--color-background-primary); border:1px solid var(--color-border-tertiary); border-radius:12px; padding:20px; }
    .card h2 { font-size:15px; font-weight:700; margin:0 0 16px; display:flex; align-items:center; gap:8px; }
    .right-col { display:flex; flex-direction:column; gap:16px; }

    /* form */
    .section-lbl { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.07em; color:var(--color-text-secondary); margin:14px 0 8px; }
    .form-grid { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
    label { display:flex; flex-direction:column; font-size:12px; color:var(--color-text-secondary); gap:4px; }
    input, select { border:1px solid var(--color-border-secondary); border-radius:6px; padding:7px 10px; font-size:13px; background:var(--color-background-secondary); outline:none; color:var(--color-text-primary); }
    input:focus, select:focus { border-color:#1D9E75; }
    .btn-primary { margin-top:18px; width:100%; padding:12px; background:#1F4E79; color:#fff; border:none; border-radius:8px; font-size:14px; font-weight:600; cursor:pointer; }
    .btn-primary:hover:not(:disabled) { background:#0C447C; }
    .btn-primary:disabled { opacity:.5; cursor:not-allowed; }
    .error-msg { margin-top:10px; color:#E24B4A; font-size:13px; }

    /* results */
    .mode-tag { font-size:11px; font-weight:400; background:#E6F1FB; color:#0C447C; padding:3px 8px; border-radius:10px; }
    .tier-badge { display:inline-block; padding:8px 20px; border-radius:20px; font-size:18px; font-weight:700; margin-bottom:16px; }
    .tier-low       { background:#E1F5EE; color:#085041; }
    .tier-medium    { background:#FAEEDA; color:#633806; }
    .tier-high      { background:#FAECE7; color:#712B13; }
    .tier-very-high { background:#FCEBEB; color:#501313; }
    .premium-row { display:flex; gap:12px; margin-bottom:14px; }
    .premium-block { flex:1; background:var(--color-background-secondary); border-radius:8px; padding:12px; text-align:center; }
    .prem-lbl { display:block; font-size:11px; color:var(--color-text-secondary); margin-bottom:4px; }
    .prem-val { font-size:22px; font-weight:700; }
    .hybrid-row { display:flex; align-items:center; gap:8px; margin-bottom:14px; flex-wrap:wrap; }
    .hybrid-block { flex:1; border-radius:8px; padding:10px 12px; text-align:center; min-width:120px; }
    .excel-block { background:#EAF3DE; border:1px solid #C0DD97; }
    .rf-block    { background:#EEEDFE; border:1px solid #AFA9EC; }
    .hb-lbl   { display:block; font-size:11px; font-weight:600; margin-bottom:2px; }
    .hb-val   { display:block; font-size:16px; font-weight:700; }
    .hb-weight{ display:block; font-size:11px; color:#777; margin-top:2px; }
    .blend-arrow { font-size:20px; color:#aaa; }
    .breakdown { background:var(--color-background-secondary); border-radius:8px; padding:12px; margin-bottom:14px; }
    .bd-lbl { font-size:11px; font-weight:600; color:var(--color-text-secondary); margin-bottom:8px; }
    .bd-row { display:flex; justify-content:space-between; font-size:13px; padding:2px 0; }
    .bd-val { font-weight:600; }
    .prob-section { margin-top:4px; }
    .prob-lbl { font-size:11px; font-weight:600; color:var(--color-text-secondary); text-transform:uppercase; letter-spacing:.06em; margin-bottom:8px; }
    .prob-row { display:flex; align-items:center; gap:8px; margin-bottom:6px; font-size:12px; }
    .prob-name { width:80px; text-align:right; color:var(--color-text-secondary); flex-shrink:0; }
    .prob-bar-wrap { flex:1; background:var(--color-background-secondary); border-radius:4px; height:10px; overflow:hidden; }
    .prob-bar { height:100%; border-radius:4px; transition:width .4s ease; }
    .pb-low { background:#1D9E75; } .pb-medium { background:#EF9F27; }
    .pb-high { background:#D85A30; } .pb-very-high { background:#E24B4A; }
    .prob-pct { width:40px; font-size:12px; color:var(--color-text-secondary); text-align:right; }
    .metrics-grid { display:grid; grid-template-columns:1fr 1fr 1fr; gap:8px; margin-bottom:14px; }
    .metric { background:var(--color-background-secondary); border-radius:8px; padding:10px 12px; }
    .m-lbl { display:block; font-size:11px; color:var(--color-text-secondary); }
    .m-val { font-size:16px; font-weight:700; }
    .fi-lbl { font-size:11px; font-weight:600; color:var(--color-text-secondary); text-transform:uppercase; letter-spacing:.06em; margin-bottom:8px; margin-top:4px; }
    .fi-row { display:flex; align-items:center; gap:8px; margin-bottom:5px; font-size:12px; }
    .fi-name { width:140px; text-align:right; color:var(--color-text-secondary); flex-shrink:0; font-size:11px; }
    .fi-bar-wrap { flex:1; background:var(--color-background-secondary); border-radius:4px; height:8px; overflow:hidden; }
    .fi-bar { height:100%; border-radius:4px; background:#2E75B6; }
    .fi-pct { width:36px; font-size:11px; color:var(--color-text-secondary); text-align:right; }
  `],
})
export class RatingEngineComponent implements OnInit {

  form = {
    ncd_grade: 14, age_condition: '35+', prefecture_code: '13',
    vehicle_rating_class: 7, driver_restriction: 'spouse',
    annual_km_band: '10,001〜15,000', driver_age: 38,
    num_accidents: 0, num_violations: 0, years_licensed: 20, mode: 'hybrid',
  };

  modes = [
    { key: 'hybrid',     label: 'Hybrid'     },
    { key: 'excel_only', label: 'Excel only'  },
    { key: 'rf_only',    label: 'RF only'     },
  ];

  get modeDesc(): string {
    const d: Record<string,string> = {
      hybrid:     'Excel 70% + RF 30% blended — recommended',
      excel_only: 'Pure actuarial chain — fully auditable',
      rf_only:    'Random Forest alone — experimental',
    };
    return d[this.form.mode] || '';
  }

  rfFeatures = [
    { col: 'ncd_grade',            desc: 'No-claim discount grade 1–20' },
    { col: 'age_condition',        desc: 'Driver age band condition' },
    { col: 'prefecture_code',      desc: 'JP prefecture 01–47' },
    { col: 'vehicle_rating_class', desc: 'Vehicle class 1–15' },
    { col: 'driver_restriction',   desc: 'none / family / spouse / self' },
    { col: 'annual_km_band',       desc: 'Annual mileage band' },
    { col: 'annual_km',            desc: 'Annual km (numeric)' },
    { col: 'driver_age',           desc: 'Driver age in years' },
    { col: 'num_accidents',        desc: 'Accidents in last 5 years' },
    { col: 'num_violations',       desc: 'Traffic violations last 5 yrs' },
    { col: 'years_licensed',       desc: 'Years since licence obtained' },
  ];

  ncdGrades = Array.from({ length: 20 }, (_, i) => i + 1);

  prefectures = [
    {code:'01',name:'北海道 Hokkaido'},{code:'02',name:'青森 Aomori'},
    {code:'03',name:'岩手 Iwate'},{code:'04',name:'宮城 Miyagi'},
    {code:'05',name:'秋田 Akita'},{code:'06',name:'山形 Yamagata'},
    {code:'07',name:'福島 Fukushima'},{code:'08',name:'茨城 Ibaraki'},
    {code:'09',name:'栃木 Tochigi'},{code:'10',name:'群馬 Gunma'},
    {code:'11',name:'埼玉 Saitama'},{code:'12',name:'千葉 Chiba'},
    {code:'13',name:'東京 Tokyo'},{code:'14',name:'神奈川 Kanagawa'},
    {code:'15',name:'新潟 Niigata'},{code:'16',name:'富山 Toyama'},
    {code:'17',name:'石川 Ishikawa'},{code:'18',name:'福井 Fukui'},
    {code:'19',name:'山梨 Yamanashi'},{code:'20',name:'長野 Nagano'},
    {code:'21',name:'岐阜 Gifu'},{code:'22',name:'静岡 Shizuoka'},
    {code:'23',name:'愛知 Aichi'},{code:'24',name:'三重 Mie'},
    {code:'25',name:'滋賀 Shiga'},{code:'26',name:'京都 Kyoto'},
    {code:'27',name:'大阪 Osaka'},{code:'28',name:'兵庫 Hyogo'},
    {code:'29',name:'奈良 Nara'},{code:'30',name:'和歌山 Wakayama'},
    {code:'31',name:'鳥取 Tottori'},{code:'32',name:'島根 Shimane'},
    {code:'33',name:'岡山 Okayama'},{code:'34',name:'広島 Hiroshima'},
    {code:'35',name:'山口 Yamaguchi'},{code:'36',name:'徳島 Tokushima'},
    {code:'37',name:'香川 Kagawa'},{code:'38',name:'愛媛 Ehime'},
    {code:'39',name:'高知 Kochi'},{code:'40',name:'福岡 Fukuoka'},
    {code:'41',name:'佐賀 Saga'},{code:'42',name:'長崎 Nagasaki'},
    {code:'43',name:'熊本 Kumamoto'},{code:'44',name:'大分 Oita'},
    {code:'45',name:'宮崎 Miyazaki'},{code:'46',name:'鹿児島 Kagoshima'},
    {code:'47',name:'沖縄 Okinawa'},
  ];

  vehicleClasses = [
    {val:1,label:'軽自動車 Kei'},{val:3,label:'小型 〜1,000cc'},
    {val:5,label:'小型 〜1,500cc'},{val:7,label:'普通 〜2,000cc'},
    {val:9,label:'普通 〜2,500cc'},{val:11,label:'普通 〜3,000cc'},
    {val:13,label:'大型 3,001cc〜'},{val:15,label:'スポーツ Sports'},
  ];

  tierOrder = ['Low','Medium','High','Very High'];

  result:      HybridResult | null = null;
  modelInfo:   ModelInfo    | null = null;
  topFeatures: { name: string; pct: number }[] = [];
  health:      HealthStatus = { model_ready: false, excel_loaded: false };
  dbStatus:    DbStatus     = { available: false, total_rows: 0, message: '' };
  trainResult: TrainResult  | null = null;
  showTrainDialog = false;

  loading   = false;
  training  = false;
  uploading = false;
  errorMsg  = '';
  uploadMsg = '';
  uploadErr = false;

  get canPredict(): boolean {
    if (this.form.mode === 'excel_only') return this.health.excel_loaded;
    return this.health.model_ready;
  }

  constructor(
    private http: HttpClient,
    private zone: NgZone,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit() { this.checkHealth(); }

  checkHealth() {
    this.http.get<HealthStatus>(`${API}/health`).subscribe({
      next: h => this.zone.run(() => {
        this.health = h;
        if (h.model_ready) this.fetchModelInfo();
        this.cdr.detectChanges();
      }),
      error: () => this.zone.run(() => {
        this.health = { model_ready: false, excel_loaded: false };
        this.cdr.detectChanges();
      }),
    });
    this.http.get<DbStatus>(`${API}/db-status`).subscribe({
      next: s => this.zone.run(() => { this.dbStatus = s; this.cdr.detectChanges(); }),
      error: () => this.zone.run(() => {
        this.dbStatus = { available: false, total_rows: 0, message: '' };
        this.cdr.detectChanges();
      }),
    });
  }

  onExcelFile(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.uploading = true;
    this.uploadMsg = '';
    this.uploadErr = false;
    const fd = new FormData();
    fd.append('file', file, file.name);
    this.http.post<any>(`${API}/upload-excel`, fd).subscribe({
      next: r => this.zone.run(() => {
        this.uploading = false;
        this.uploadMsg = `✓ ${r.message}`;
        this.checkHealth();
        this.cdr.detectChanges();
      }),
      error: e => this.zone.run(() => {
        this.uploading = false;
        this.uploadMsg = e.error?.detail || 'Upload failed';
        this.uploadErr = true;
        this.cdr.detectChanges();
      }),
    });
  }

  trainModel() {
    this.training = true;
    const source = this.dbStatus.available ? 'database' : 'synthetic';
    const n_samples = this.dbStatus.available ? 1000000 : 10000;
    this.http.post<TrainResult>(`${API}/train`, { n_samples, source }).subscribe({
      next: r => this.zone.run(() => {
        this.trainResult = r;
        this.training    = false;
        this.showTrainDialog = true;
        this.checkHealth();
        this.cdr.detectChanges();
      }),
      error: () => this.zone.run(() => {
        this.training = false;
        this.cdr.detectChanges();
      }),
    });
  }

  closeDialog() {
    this.showTrainDialog = false;
    this.cdr.detectChanges();
  }

  predict() {
    this.loading  = true;
    this.errorMsg = '';
    this.http.post<HybridResult>(`${API}/predict`, this.form).subscribe({
      next: r => this.zone.run(() => {
        this.result  = r;
        this.loading = false;
        this.cdr.detectChanges();
      }),
      error: e => this.zone.run(() => {
        this.errorMsg = e.error?.detail || 'Prediction failed';
        this.loading  = false;
        this.cdr.detectChanges();
      }),
    });
  }

  fetchModelInfo() {
    this.http.get<ModelInfo>(`${API}/model/info`).subscribe({
      next: info => this.zone.run(() => {
        this.modelInfo = info;
        const imp   = info.feature_importance.classification;
        const total = Object.values(imp).reduce((a, b) => a + b, 0);
        this.topFeatures = Object.entries(imp)
          .map(([name, val]) => ({ name, pct: (val / total) * 100 }))
          .sort((a, b) => b.pct - a.pct)
          .slice(0, 8);
        this.cdr.detectChanges();
      }),
    });
  }

  tierClass(tier: string): string {
    return 'tier-badge tier-' + tier.toLowerCase().replace(' ', '-');
  }

  breakdownRows() {
    if (!this.result?.excel_breakdown) return [];
    const b = this.result.excel_breakdown;
    return [
      { name: '対人賠償 Bodily injury',   val: b.bi_premium        },
      { name: '対物賠償 Property damage',  val: b.pd_premium        },
      { name: '車両保険 Vehicle damage',   val: b.vehicle_premium   },
      { name: '搭乗者傷害 Passenger',      val: b.passenger_premium },
    ];
  }
}
