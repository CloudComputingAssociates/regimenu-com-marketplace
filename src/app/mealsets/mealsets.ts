// src/app/mealsets/mealsets.ts
// The MealSets section page at /mealsets: a state-dependent intro atop the
// catalog.
//   - anonymous, OR authenticated with zero owned sets → the MealSets explainer
//   - authenticated with ≥1 owned set → "Hungry for new ideas?" band + My MealSets shelf
// The catalog (BrowseComponent) always renders below the intro. While auth /
// entitlements resolve, the intro is blank — never flash the explainer and then
// swap in the shelf from under an owner.
import { Component, ChangeDetectionStrategy, inject, signal, computed, effect } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { AuthService } from '@auth0/auth0-angular';
import { MealSetService } from './mealset.service';
import { LandingComponent } from './landing/landing';
import { MyMealsetsComponent } from './my-mealsets/my-mealsets';
import { BrowseComponent } from './browse/browse';

@Component({
  selector: 'app-mealsets',
  standalone: true,
  imports: [LandingComponent, MyMealsetsComponent, BrowseComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @switch (view()) {
      @case ('shelf') {
        <div class="ms-container mealsets-intro">
          <!-- Slim salesy band — not a hero; the shelf is the star. -->
          <section class="band">
            <h1 class="band__title">Hungry for new ideas?</h1>
            <p class="band__sub">
              Fresh, healthy mealsets from coaches, authors, chefs and Registered
              Dieticians - ready to use, today!
            </p>
          </section>

          <section class="my">
            <h2 class="my__title">My MealSets</h2>
            <app-my-mealsets />
          </section>
        </div>
      }
      @case ('explainer') {
        <app-landing />
      }
      @default {
        <!-- Resolving auth/entitlements — intentionally blank, no explainer flash. -->
        <div class="mealsets-intro--resolving" aria-hidden="true"></div>
      }
    }

    <!-- The catalog is state-independent; it renders for everyone. -->
    <app-browse />
  `,
  styleUrl: './mealsets.scss',
})
export class MealsetsComponent {
  private auth = inject(AuthService);
  private svc = inject(MealSetService);

  private authLoading = toSignal(this.auth.isLoading$, { initialValue: true });
  private isAuthenticated = toSignal(this.auth.isAuthenticated$, { initialValue: false });
  private entitledResolved = signal(false);
  private started = false;

  readonly view = computed<'resolving' | 'explainer' | 'shelf'>(() => {
    if (this.authLoading()) return 'resolving';
    if (!this.isAuthenticated()) return 'explainer';
    if (!this.entitledResolved()) return 'resolving';
    return this.svc.entitled().length > 0 ? 'shelf' : 'explainer';
  });

  constructor() {
    // Once auth finishes loading, resolve entitlements exactly once. Reuse the
    // service cache if a prior page already loaded the entitled list.
    effect(() => {
      if (this.authLoading() || this.started) return;
      this.started = true;

      if (!this.isAuthenticated()) {
        this.entitledResolved.set(true);
        return;
      }
      if (this.svc.entitledLoaded()) {
        this.entitledResolved.set(true);
        return;
      }
      this.svc.loadEntitled().subscribe({
        next: () => this.entitledResolved.set(true),
        error: () => this.entitledResolved.set(true),
      });
    });
  }
}
