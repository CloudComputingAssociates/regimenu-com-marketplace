// src/app/components/meal-placeholder/meal-placeholder.ts
// Branded fallback graphic for MealSets with no picture. Inline SVG (no network
// asset), fills its container. Used on browse cards, the set-detail gallery, and
// the purchase-pending cover.
import { Component, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'app-meal-placeholder',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg viewBox="0 0 320 200" preserveAspectRatio="xMidYMid slice"
      xmlns="http://www.w3.org/2000/svg" role="img" aria-label="MealSet">
      <defs>
        <linearGradient id="mpBg" x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0" stop-color="#eaf1fc" />
          <stop offset="1" stop-color="#f6f9fe" />
        </linearGradient>
      </defs>
      <rect width="320" height="200" fill="url(#mpBg)" />

      <!-- plate -->
      <circle cx="160" cy="92" r="48" fill="#ffffff" stroke="#d7e1f2" stroke-width="2" />
      <circle cx="160" cy="92" r="31" fill="none" stroke="#e7eefa" stroke-width="2" />

      <!-- fork (left) -->
      <g stroke="#9db2d6" stroke-width="3" stroke-linecap="round" fill="none">
        <path d="M120 60 v20" />
        <path d="M128 60 v20" />
        <path d="M136 60 v20" />
        <path d="M128 80 q0 6 -4 8 v34" />
        <path d="M128 80 q0 6 4 8 v34" />
        <!-- knife (right) -->
        <path d="M200 60 q10 4 10 22 q0 8 -6 10 v30" />
      </g>

      <!-- brand diamond -->
      <path d="M160 152 l7 7 -7 7 -7 -7 z" fill="#1667d6" opacity="0.55" />
      <text x="160" y="182" text-anchor="middle"
        font-family="Inter, sans-serif" font-size="12" font-weight="700"
        letter-spacing="2.5" fill="#9db2d6">MEALSET</text>
    </svg>
  `,
  styles: [
    `
      :host {
        display: block;
        width: 100%;
        height: 100%;
      }
      svg {
        display: block;
        width: 100%;
        height: 100%;
      }
    `,
  ],
})
export class MealPlaceholderComponent {}
