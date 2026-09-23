// src/app/pages/browse/browse.ts
// The full public catalog grid with genre multi-select + Free/Paid filters.
// Owned sets are shown too, badged ✓ Owned with a disabled Add-to-Cart (they
// also appear on the "My MealSets" shelf at `/`). Welcoming for anonymous.
import { Component, ChangeDetectionStrategy, inject, signal, computed, effect } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink, Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '@auth0/auth0-angular';
import { MealSetService } from '../../services/mealset.service';
import { MealSetCatalogEntry } from '../../models/mealset.models';
import { MealPlaceholderComponent } from '../../components/meal-placeholder/meal-placeholder';

type PriceFilter = 'all' | 'free' | 'paid';

@Component({
  selector: 'app-browse',
  standalone: true,
  imports: [RouterLink, MealPlaceholderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ms-container browse">
      <header class="browse__head">
        <h1 class="browse__title">Browse MealSets</h1>
        <p class="browse__sub">Chef-built, focused meals in 5-packs, ready for you to prepare. One-click download to your RegiMenu Notebook, and start planning!</p>
      </header>

      <!-- Price filter: conspicuous segmented control (client-side) -->
      <div class="seg" role="group" aria-label="Filter by price">
        <button class="seg__btn" [class.seg__btn--on]="priceFilter() === 'all'"
          (click)="priceFilter.set('all')">All</button>
        <button class="seg__btn seg__btn--free" [class.seg__btn--on]="priceFilter() === 'free'"
          (click)="priceFilter.set('free')">Free</button>
        <button class="seg__btn" [class.seg__btn--on]="priceFilter() === 'paid'"
          (click)="priceFilter.set('paid')">Paid</button>
      </div>

      <!-- Genre chips: multi-select. "All" clears the selection; a card must
           match EVERY selected genre (intersection). -->
      <div class="controls">
        <div class="chips" role="group" aria-label="Filter by genre">
          <button
            class="chip"
            [class.chip--on]="selectedGenres().size === 0"
            (click)="clearGenres()">
            All
          </button>
          @for (g of svc.genres(); track g) {
            <button
              class="chip"
              [class.chip--on]="selectedGenres().has(g)"
              (click)="toggleGenre(g)">
              {{ g }}
            </button>
          }
        </div>
        <button class="sort" (click)="toggleSort()">
          Name {{ sortAsc() ? '▲ A–Z' : '▼ Z–A' }}
        </button>
      </div>

      @if (svc.loading() && !svc.loaded()) {
        <p class="state">Loading MealSets…</p>
      } @else if (svc.error()) {
        <p class="state state--err">{{ svc.error() }}</p>
      } @else if (visible().length === 0) {
        <div class="state">
          <p>No MealSets match all selected filters.</p>
          <button class="ms-btn ms-btn--ghost" (click)="clearAllFilters()">Clear filters</button>
        </div>
      } @else {
        <div class="grid">
          @for (entry of visible(); track entry.mealSetId) {
            <div class="card">
              <a class="card__link" [routerLink]="['/set', entry.mealSetId]">
                <div class="card__media">
                  @if (entry.mealSetPic1) {
                    <img class="card__img" [src]="entry.mealSetPic1" [alt]="entry.name" loading="lazy" />
                  } @else {
                    <app-meal-placeholder class="card__noimg" />
                  }
                  @if (isOwned(entry.mealSetId)) {
                    <span class="badge badge--owned">✓ Owned</span>
                  }
                  <span class="card__hint">Click for details</span>
                </div>
                <div class="card__body">
                  <div class="card__titlerow">
                    <h2 class="card__name">
                      {{ entry.name }}@if (entry.mealCount != null) {
                        <span class="card__count">({{ entry.mealCount }})</span>
                      }
                    </h2>
                    <span class="card__price" [class.card__price--free]="entry.price === 0">
                      {{ priceLabel(entry.price) }}
                    </span>
                  </div>
                  @if (entry.authorName) {
                    <p class="card__author">by {{ entry.authorName }}</p>
                  }
                  @if (entry.genres.length) {
                    <div class="card__genres">
                      @for (g of entry.genres; track g) {
                        <span class="card__genre">{{ g }}</span>
                      }
                    </div>
                  }
                  @if (entry.description) {
                    <p class="card__desc">{{ entry.description }}</p>
                  }
                </div>
              </a>
              <div class="card__actions">
                <button
                  class="ms-btn ms-btn--primary card__cart"
                  [disabled]="isOwned(entry.mealSetId) || busyId() === entry.mealSetId"
                  (click)="addToCart(entry)">
                  {{ isOwned(entry.mealSetId) ? '✓ Owned' : (busyId() === entry.mealSetId ? 'Working…' : 'Add to Cart') }}
                </button>
              </div>
            </div>
          }
        </div>
      }
    </div>
  `,
  styleUrl: './browse.scss',
})
export class BrowseComponent {
  protected svc = inject(MealSetService);
  private auth = inject(AuthService);
  private router = inject(Router);
  private isAuthenticated = toSignal(this.auth.isAuthenticated$, { initialValue: false });

  /** Multi-select genre filter. Empty set = "All" (no genre filter). */
  readonly selectedGenres = signal<ReadonlySet<string>>(new Set());
  readonly priceFilter = signal<PriceFilter>('all');
  readonly sortAsc = signal(true);
  /** mealSetId with an in-flight add-to-cart action (disables just that card). */
  readonly busyId = signal<number | null>(null);

  /** Browse grid: the full catalog (owned sets included, badged ✓ Owned) after
   *  the genre intersection + price filters + name sort — all client-side. */
  readonly visible = computed<MealSetCatalogEntry[]>(() => {
    const genres = this.selectedGenres();
    const price = this.priceFilter();
    const asc = this.sortAsc();
    const list = this.svc
      .entries()
      .filter(e =>
        genres.size === 0 ? true : [...genres].every(g => e.genres.includes(g)),
      )
      .filter(e =>
        price === 'all' ? true : price === 'free' ? e.price === 0 : e.price > 0,
      );
    return [...list].sort((a, b) => {
      const cmp = a.name.localeCompare(b.name);
      return asc ? cmp : -cmp;
    });
  });

  constructor() {
    // One-shot public catalog load (cached in the store).
    this.svc.loadCatalog().subscribe({ error: () => {} });

    // When the visitor is (or becomes) authenticated, pull entitlements so owned
    // sets drop out of the grid. Anonymous visitors never trigger this.
    effect(() => {
      if (this.isAuthenticated()) {
        this.svc.loadEntitled().subscribe({ error: () => {} });
      }
    });
  }

  // ---- Filters --------------------------------------------------------------
  /** Toggle a genre in/out of the multi-select set. */
  toggleGenre(g: string): void {
    this.selectedGenres.update(cur => {
      const next = new Set(cur);
      next.has(g) ? next.delete(g) : next.add(g);
      return next;
    });
  }

  /** "All" — clear the genre selection (no genre filter). */
  clearGenres(): void {
    this.selectedGenres.set(new Set());
  }

  /** Empty-state reset: clear genres AND price filter. */
  clearAllFilters(): void {
    this.clearGenres();
    this.priceFilter.set('all');
  }

  isOwned(id: number): boolean {
    return this.isAuthenticated() && this.svc.entitledIds().has(id);
  }

  priceLabel(price: number): string {
    return price === 0 ? 'Free' : `$${price.toFixed(2)}`;
  }

  /**
   * Add-to-cart. There is no cart/multi-item checkout in the API, so this runs
   * the existing per-set flow: anon → login (returning to the set page), free →
   * acquire then pending, paid → Stripe checkout. 409 → already owned.
   */
  addToCart(e: MealSetCatalogEntry): void {
    if (this.isOwned(e.mealSetId) || this.busyId() !== null) return;

    if (!this.isAuthenticated()) {
      this.auth.loginWithRedirect({ appState: { target: `/set/${e.mealSetId}` } });
      return;
    }

    this.busyId.set(e.mealSetId);
    if (e.price === 0) {
      this.svc.acquire(e.mealSetId).subscribe({
        next: () => {
          this.busyId.set(null);
          void this.router.navigate(['/purchase/pending'], {
            queryParams: { setId: e.mealSetId },
          });
        },
        error: err => this.handleCartError(err),
      });
    } else {
      this.svc.checkout(e.mealSetId).subscribe({
        next: res => {
          if (res?.url) {
            window.location.href = res.url;
          } else {
            this.busyId.set(null);
          }
        },
        error: err => this.handleCartError(err),
      });
    }
  }

  /** 409 → already owned; refresh entitlements so the set drops from the grid. */
  private handleCartError(err: unknown): void {
    this.busyId.set(null);
    if (err instanceof HttpErrorResponse && err.status === 409) {
      this.svc.loadEntitled(true).subscribe({ error: () => {} });
    }
  }

  toggleSort(): void {
    this.sortAsc.update(v => !v);
  }
}
