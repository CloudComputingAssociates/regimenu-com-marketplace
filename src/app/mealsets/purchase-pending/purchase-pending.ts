// src/app/pages/purchase-pending/purchase-pending.ts
// Auth'd. Shown right after acquire (free) or return from Stripe (paid). Polls
// GET /owned every 2s; on owned → /purchase/delivered. After 30s, stops and
// tells the user their meals will appear shortly (webhook still settling).
import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  OnInit,
  OnDestroy,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MealSetService } from '../mealset.service';
import { MealSetCatalogEntry } from '../mealset.models';
import { MealPlaceholderComponent } from '../meal-placeholder/meal-placeholder';
import { environment } from '../../../environments/environment';

const POLL_MS = 2000;
const TIMEOUT_MS = 30000;

@Component({
  selector: 'app-purchase-pending',
  standalone: true,
  imports: [MealPlaceholderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ms-container pending">
      <div class="pending__card">
        @if (cover(); as url) {
          <img class="pending__cover" [src]="url" [alt]="entry()?.name || 'Your MealSet'" />
        } @else {
          <app-meal-placeholder class="pending__cover pending__cover--none" />
        }

        @if (!timedOut()) {
          <div class="spinner" aria-hidden="true"></div>
          <h1 class="pending__title">Preparing your meals…</h1>
          <p class="pending__sub">
            @if (entry(); as e) {
              Adding <strong>{{ e.name }}</strong> to your notebook. This only takes a moment.
            } @else {
              Adding your MealSet to your notebook. This only takes a moment.
            }
          </p>
        } @else {
          <h1 class="pending__title">Payment received</h1>
          <p class="pending__sub">
            Your meals will appear in your notebook shortly.
          </p>
          <a [href]="cockpitUrl" class="ms-btn ms-btn--primary">Check my notebook</a>
        }
      </div>
    </div>
  `,
  styleUrl: './purchase-pending.scss',
})
export class PurchasePendingComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private svc = inject(MealSetService);

  readonly cockpitUrl = environment.cockpitUrl;
  readonly entry = signal<MealSetCatalogEntry | undefined>(undefined);
  readonly timedOut = signal(false);

  readonly cover = signal<string | undefined>(undefined);

  private setId = NaN;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private stopTimer: ReturnType<typeof setTimeout> | null = null;

  ngOnInit(): void {
    this.setId = Number(this.route.snapshot.queryParamMap.get('setId'));
    if (!Number.isFinite(this.setId)) {
      void this.router.navigate(['/mealsets']);
      return;
    }

    // Cover pic — resolve the entry from the store (fetches catalog if needed).
    this.svc.getEntry(this.setId).subscribe({
      next: e => {
        this.entry.set(e);
        this.cover.set(e?.mealSetPic1);
      },
      error: () => {},
    });

    // Poll ownership every 2s; hand off to delivered on success.
    this.poll();
    this.pollTimer = setInterval(() => this.poll(), POLL_MS);

    // Hard stop at 30s.
    this.stopTimer = setTimeout(() => {
      this.clearTimers();
      this.timedOut.set(true);
    }, TIMEOUT_MS);
  }

  private poll(): void {
    this.svc.isOwned(this.setId).subscribe({
      next: owned => {
        if (owned) {
          this.clearTimers();
          void this.router.navigate(['/mealsets/purchase/delivered'], {
            queryParams: { setId: this.setId },
          });
        }
      },
      error: () => {},
    });
  }

  private clearTimers(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    if (this.stopTimer) {
      clearTimeout(this.stopTimer);
      this.stopTimer = null;
    }
  }

  ngOnDestroy(): void {
    this.clearTimers();
  }
}
