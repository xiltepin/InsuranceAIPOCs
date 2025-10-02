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