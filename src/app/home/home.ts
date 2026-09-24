// src/app/home/home.ts
// Marketplace storefront at `/`. A hero over a departments grid. Departments are
// driven by a small config array so adding one is a single entry. Only live
// departments are clickable; the rest show a muted "Coming soon" tag.
import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink } from '@angular/router';

interface Department {
  key: string;
  title: string;
  blurb: string;
  live: boolean;
  route?: string; // live only
  cta?: string; // live only
  icon?: string; // Material Icons ligature for coming-soon departments
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="hero">
      <div class="ms-container hero__inner">
        <h1 class="hero__title">Welcome to the RegiMenu Marketplace</h1>
        <p class="hero__sub">
          Add-ons for your RegiMenu plan, from chef-built meal packs to what's coming
          next. One RegiMenu account works across the app and the marketplace.
        </p>
      </div>
    </section>

    <section class="depts">
      <div class="ms-container depts__grid">
        @for (d of departments; track d.key) {
          <article class="dept" [class.dept--soon]="!d.live">
            <div class="dept__icon" aria-hidden="true">
              @if (d.key === 'mealsets') {
                <img src="/images/yeh_logo_dark.png" alt="" />
              } @else {
                <span class="material-icons">{{ d.icon }}</span>
              }
            </div>
            <h2 class="dept__title">{{ d.title }}</h2>
            <p class="dept__blurb">{{ d.blurb }}</p>
            @if (d.live) {
              <a [routerLink]="d.route" class="ms-btn ms-btn--primary dept__cta">{{ d.cta }}</a>
            } @else {
              <span class="dept__soon">Coming soon</span>
            }
          </article>
        }
      </div>
    </section>
  `,
  styleUrl: './home.scss',
})
export class HomeComponent {
  readonly departments: Department[] = [
    {
      key: 'mealsets',
      title: 'MealSets',
      blurb: 'Chef-built, macro-true meal packs that drop straight into your notebook.',
      live: true,
      route: '/mealsets',
      cta: 'Browse MealSets',
    },
    {
      key: 'merch',
      title: 'Merch',
      blurb: 'RegiMenu gear for your kitchen and your day.',
      live: false,
      icon: 'checkroom',
    },
    {
      key: 'training',
      title: 'Training',
      blurb: 'Guided programs from RegiMenu coaches.',
      live: false,
      icon: 'fitness_center',
    },
    {
      key: 'glp1',
      title: 'GLP-1 Resources',
      blurb: 'Practical guidance for eating well on GLP-1 medications.',
      live: false,
      icon: 'medication',
    },
  ];
}
