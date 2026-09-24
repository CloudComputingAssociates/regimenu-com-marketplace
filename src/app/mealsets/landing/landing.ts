// src/app/mealsets/landing/landing.ts
// MealSets explainer — the intro atop /mealsets for newcomers. Typography-led
// hero headline + paragraph, then a three-step value strip. No CTA: the catalog
// sits directly below this on the page.
import { Component, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'app-landing',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="hero">
      <div class="ms-container hero__inner">
        <h1 class="hero__title">
          MealSets — chef-built, macro-true<br />meal packs for your RegiMenu notebook.
        </h1>
        <p class="hero__sub">
          Curated packs of real meals with real macros, built by chefs and coaches.
          Add a set to your notebook and it is ready to plan against in seconds.
        </p>
      </div>
    </section>

    <section class="steps">
      <div class="ms-container steps__grid">
        <div class="step">
          <span class="step__num">1</span>
          <h3 class="step__title">Browse</h3>
          <p class="step__body">
            Explore chef-built meal packs by genre — from cutting to bulking to
            plant-forward. Every macro is already dialed in.
          </p>
        </div>
        <div class="step">
          <span class="step__num">2</span>
          <h3 class="step__title">Add to your notebook</h3>
          <p class="step__body">
            Free sets drop straight into your notebook. Paid packs check out in one
            step and land the moment payment clears.
          </p>
        </div>
        <div class="step">
          <span class="step__num">3</span>
          <h3 class="step__title">Plan your week</h3>
          <p class="step__body">
            Your new meals are instantly available in the RegiMenu app to schedule,
            swap, and track against your targets.
          </p>
        </div>
      </div>
    </section>
  `,
  styleUrl: './landing.scss',
})
export class LandingComponent {}
