// src/app/pages/purchase-delivered/purchase-delivered.ts
// Auth'd. Confirmation page. Counts the delivered meals via
// GET /api/meal?mealSetIds={setId} and celebrates. If the count is 0 (rare
// webhook lag), falls back to a generic reassurance.
import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  OnInit,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MealSetService } from '../mealset.service';
import { MealSetCatalogEntry } from '../mealset.models';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-purchase-delivered',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ms-container delivered">
      <div class="delivered__card">
        <div class="delivered__check" aria-hidden="true">✓</div>

        @if (loading()) {
          <h1 class="delivered__title">Finishing up…</h1>
        } @else if (count() > 0) {
          <h1 class="delivered__title">
            {{ count() }} {{ count() === 1 ? 'meal' : 'meals' }} added to your notebook
          </h1>
          @if (entry()?.name) {
            <p class="delivered__sub">from <strong>{{ entry()?.name }}</strong></p>
          }
        } @else {
          <h1 class="delivered__title">Your meals are in your notebook.</h1>
          @if (entry()?.name) {
            <p class="delivered__sub"><strong>{{ entry()?.name }}</strong> is ready to plan.</p>
          }
        }

        <div class="delivered__cta">
          <a [href]="cockpitUrl" class="ms-btn ms-btn--primary">Open my notebook</a>
          <a routerLink="/mealsets" class="ms-btn ms-btn--ghost">Back to my MealSets</a>
        </div>
      </div>
    </div>
  `,
  styleUrl: './purchase-delivered.scss',
})
export class PurchaseDeliveredComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private svc = inject(MealSetService);

  readonly cockpitUrl = environment.cockpitUrl;
  readonly entry = signal<MealSetCatalogEntry | undefined>(undefined);
  readonly count = signal(0);
  readonly loading = signal(true);

  ngOnInit(): void {
    const setId = Number(this.route.snapshot.queryParamMap.get('setId'));
    if (!Number.isFinite(setId)) {
      void this.router.navigate(['/mealsets']);
      return;
    }

    // Set name for the confirmation copy.
    this.svc.getEntry(setId).subscribe({ next: e => this.entry.set(e), error: () => {} });

    // Count the delivered meals.
    this.svc.getSetMeals(setId).subscribe({
      next: meals => {
        this.count.set(Array.isArray(meals) ? meals.length : 0);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}
