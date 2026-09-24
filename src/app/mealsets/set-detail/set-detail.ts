// src/app/pages/set-detail/set-detail.ts
// Public per-set marketing page. Resolves the entry from the catalog store
// (fetches the catalog if this was a deep-link). Drives the acquire/checkout CTA
// per the client decision rule (price 0 → acquire, price > 0 → checkout) and the
// auth/ownership matrix.
import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  computed,
  effect,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '@auth0/auth0-angular';
import { MealSetService } from '../mealset.service';
import { NotificationService } from '../../services/notification.service';
import { MealSetCatalogEntry, Meal } from '../mealset.models';
import { MealPlaceholderComponent } from '../meal-placeholder/meal-placeholder';
import { MealListComponent } from '../meal-list/meal-list';

@Component({
  selector: 'app-set-detail',
  standalone: true,
  imports: [RouterLink, MealPlaceholderComponent, MealListComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ms-container detail">
      @if (loading()) {
        <p class="state">Loading…</p>
      } @else if (!entry()) {
        <div class="state">
          <p>This MealSet could not be found.</p>
          <a routerLink="/mealsets" class="ms-btn ms-btn--ghost">Back to browse</a>
        </div>
      } @else if (entry(); as e) {
        <a routerLink="/mealsets" class="detail__back">← All MealSets</a>

        <div class="detail__grid">
          <!-- Gallery: pics 1–4 + optional video -->
          <div class="gallery">
            <div class="gallery__main">
              @if (activeMedia(); as m) {
                @if (m.kind === 'video') {
                  <video class="gallery__video" [src]="m.url" controls></video>
                } @else {
                  <img class="gallery__img" [src]="m.url" [alt]="e.name" />
                }
              } @else {
                <app-meal-placeholder class="gallery__noimg" />
              }
            </div>
            @if (media().length > 1) {
              <div class="gallery__thumbs">
                @for (m of media(); track m.url; let i = $index) {
                  <button
                    class="thumb"
                    [class.thumb--on]="i === activeIndex()"
                    (click)="activeIndex.set(i)">
                    @if (m.kind === 'video') {
                      <span class="thumb__play">▶</span>
                    } @else {
                      <img [src]="m.url" alt="" />
                    }
                  </button>
                }
              </div>
            }
          </div>

          <!-- Info + CTA -->
          <div class="info">
            @if (e.genres.length) {
              <div class="info__genres">
                @for (g of e.genres; track g) {
                  <span class="info__genre">{{ g }}</span>
                }
              </div>
            }
            <h1 class="info__name">{{ e.name }}</h1>
            @if (e.authorName) {
              <p class="info__by">
                by {{ e.authorName }}
                @if (hasAuthorDetail(e)) {
                  <button type="button" class="info__authorlink" (click)="authorOpen.set(true)">
                    About the author ⓘ
                  </button>
                }
              </p>
            }

            <div class="info__cta">
              @if (owned()) {
                <span class="owned-badge">✓ Owned</span>
                <button
                  class="ms-btn ms-btn--primary"
                  [disabled]="busy()"
                  (click)="onRedownload(e)">
                  {{ busy() ? 'Working…' : 'Re-download meals' }}
                </button>
              } @else {
                <span class="info__price" [class.info__price--free]="e.price === 0">
                  {{ priceLabel(e.price) }}
                </span>
                <button
                  class="ms-btn ms-btn--primary"
                  [disabled]="busy()"
                  (click)="onCta(e)">
                  {{ busy() ? 'Working…' : ctaLabel(e) }}
                </button>
              }
            </div>
            @if (errorMsg()) {
              <p class="info__err">{{ errorMsg() }}</p>
            }

            @if (e.description) {
              <p class="info__desc">{{ e.description }}</p>
            }
          </div>
        </div>

        <!-- Meals in this set. The meal contents (GET /api/meal) are owners-only
             per the API, so we render the full list once the set is owned and
             show a locked teaser otherwise. -->
        <section class="meals-section">
          <h2 class="meals-section__h">
            What's inside@if (e.mealCount != null) { <span class="meals-section__count">· {{ e.mealCount }} meals</span> }
          </h2>
          @if (owned()) {
            @if (mealsLoading()) {
              <p class="meals-section__state">Loading meals…</p>
            } @else if (meals().length) {
              <app-meal-list [meals]="meals()" />
            } @else {
              <p class="meals-section__state">Your meals are in your notebook.</p>
            }
          } @else {
            <div class="meals-locked">
              <span class="meals-locked__icon" aria-hidden="true">🔒</span>
              <p class="meals-locked__text">
                {{ e.price === 0 ? 'Add this set' : 'Purchase this set' }} to see every meal —
                photos, ingredients, and full macros.
              </p>
            </div>
          }
        </section>

        <!-- Author "bloom" modal — opened from the link under the author name. -->
        @if (authorOpen()) {
          <div class="author-modal" (click)="authorOpen.set(false)">
            <div
              class="author-modal__card"
              role="dialog"
              aria-modal="true"
              aria-label="About the author"
              (click)="$event.stopPropagation()">
              <button class="author-modal__close" (click)="authorOpen.set(false)" aria-label="Dismiss">
                ✕
              </button>
              @if (e.authorPic) {
                <img class="author-modal__pic" [src]="e.authorPic" [alt]="e.authorName || 'Author'" />
              }
              @if (e.authorName) {
                <h3 class="author-modal__name">{{ e.authorName }}</h3>
              }
              @if (e.authorCredentials) {
                <p class="author-modal__creds">{{ e.authorCredentials }}</p>
              }
              @if (e.authorBio) {
                <p class="author-modal__bio">{{ e.authorBio }}</p>
              }
              @if (e.backLink) {
                <a class="author-modal__link" [href]="e.backLink" target="_blank" rel="noopener">
                  @if (e.backLinkPhoto) {
                    <img class="author-modal__linkpic" [src]="e.backLinkPhoto" alt="" />
                  }
                  More from this author →
                </a>
              }
            </div>
          </div>
        }
      }
    </div>
  `,
  styleUrl: './set-detail.scss',
})
export class SetDetailComponent {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private svc = inject(MealSetService);
  private auth = inject(AuthService);
  private notify = inject(NotificationService);

  private isAuthenticated = toSignal(this.auth.isAuthenticated$, { initialValue: false });

  private readonly setId = signal<number>(NaN);
  readonly entry = signal<MealSetCatalogEntry | undefined>(undefined);
  readonly loading = signal(true);
  readonly owned = signal(false);
  /** "About the author" bloom modal open state. */
  readonly authorOpen = signal(false);
  readonly busy = signal(false);
  readonly errorMsg = signal<string | null>(null);

  /** Meals inside the set — owners only (GET /api/meal is auth + entitlement). */
  readonly meals = signal<Meal[]>([]);
  readonly mealsLoading = signal(false);

  readonly activeIndex = signal(0);

  /** Ordered gallery media: pics 1–4 then video1. */
  readonly media = computed<{ kind: 'image' | 'video'; url: string }[]>(() => {
    const e = this.entry();
    if (!e) return [];
    const items: { kind: 'image' | 'video'; url: string }[] = [];
    for (const url of [e.mealSetPic1, e.mealSetPic2, e.mealSetPic3, e.mealSetPic4]) {
      if (url) items.push({ kind: 'image', url });
    }
    if (e.mealSetVideo1) items.push({ kind: 'video', url: e.mealSetVideo1 });
    return items;
  });
  readonly activeMedia = computed(() => this.media()[this.activeIndex()]);

  constructor() {
    // Resolve the id from the route (supports navigating between sets).
    this.route.paramMap.subscribe(pm => {
      const id = Number(pm.get('id'));
      this.setId.set(id);
      this.activeIndex.set(0);
      this.owned.set(false);
      this.meals.set([]);
      this.errorMsg.set(null);
      this.authorOpen.set(false);

      if (!Number.isFinite(id)) {
        this.entry.set(undefined);
        this.loading.set(false);
        return;
      }

      // Seed instantly from the store if present, then confirm via resolve.
      this.entry.set(this.svc.peekEntry(id));
      this.loading.set(true);
      this.svc.getEntry(id).subscribe({
        next: e => {
          this.entry.set(e);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
    });

    // Check ownership whenever we have an id AND an authenticated session.
    effect(() => {
      const id = this.setId();
      if (this.isAuthenticated() && Number.isFinite(id)) {
        this.svc.isOwned(id).subscribe({
          next: v => this.owned.set(v),
          error: () => {},
        });
      }
    });

    // Once the set is owned, load its meals (owners-only endpoint) for the
    // "What's inside" list. Guard on id so switching sets refetches.
    effect(() => {
      const id = this.setId();
      if (this.owned() && Number.isFinite(id)) {
        this.mealsLoading.set(true);
        this.svc.getSetMeals(id).subscribe({
          next: meals => {
            this.meals.set(Array.isArray(meals) ? meals : []);
            this.mealsLoading.set(false);
          },
          error: () => this.mealsLoading.set(false),
        });
      }
    });
  }

  priceLabel(price: number): string {
    return price === 0 ? 'Free' : `$${price.toFixed(2)}`;
  }

  /** Whether there's author detail worth opening the bloom modal for. */
  hasAuthorDetail(e: MealSetCatalogEntry): boolean {
    return !!(e.authorBio || e.authorCredentials || e.authorPic || e.backLink);
  }

  ctaLabel(e: MealSetCatalogEntry): string {
    return e.price === 0 ? 'Add to my notebook' : 'Buy Now';
  }

  onCta(e: MealSetCatalogEntry): void {
    // Not authenticated → send to Auth0, returning to this page afterward.
    if (!this.isAuthenticated()) {
      this.auth.loginWithRedirect({ appState: { target: this.router.url } });
      return;
    }

    this.errorMsg.set(null);
    this.busy.set(true);

    if (e.price === 0) {
      // FREE → acquire, then land on the pending page.
      this.svc.acquire(e.mealSetId).subscribe({
        next: () => {
          this.busy.set(false);
          void this.router.navigate(['/mealsets/purchase/pending'], {
            queryParams: { setId: e.mealSetId },
          });
        },
        error: err => this.handleAcquireError(err),
      });
    } else {
      // PAID → checkout, then redirect the browser to Stripe.
      this.svc.checkout(e.mealSetId).subscribe({
        next: res => {
          if (res?.url) {
            window.location.href = res.url;
          } else {
            this.busy.set(false);
            this.errorMsg.set('Checkout did not return a payment link. Please try again.');
          }
        },
        error: err => this.handleAcquireError(err),
      });
    }
  }

  /** Owned-mode secondary action: re-materialize only the MISSING meals from
   *  the set back into the notebook (idempotent). Mirrors the acquire flow. */
  onRedownload(e: MealSetCatalogEntry): void {
    this.errorMsg.set(null);
    this.busy.set(true);
    this.svc.redownload(e.mealSetId).subscribe({
      next: res => {
        this.busy.set(false);
        if (res.materializedCount > 0) {
          this.notify.show(`${res.materializedCount} meals added back to your notebook.`);
          void this.router.navigate(['/mealsets/purchase/delivered'], {
            queryParams: { setId: e.mealSetId },
          });
        } else {
          this.notify.show('All of this set\'s meals are already in your notebook.', 'info');
        }
      },
      error: err => {
        this.busy.set(false);
        // 404 = no purchase on record; re-confirm ownership defensively.
        if (err instanceof HttpErrorResponse && err.status === 404) {
          this.svc.isOwned(this.setId()).subscribe({
            next: v => this.owned.set(v),
            error: () => {},
          });
          return;
        }
        this.notify.show('Something went wrong. Please try again.', 'error');
      },
    });
  }

  /** 409 from acquire/checkout → already owned; flip to the owned state and
   *  refresh the authoritative flag. Other errors surface a message. */
  private handleAcquireError(err: unknown): void {
    this.busy.set(false);
    if (err instanceof HttpErrorResponse && err.status === 409) {
      this.owned.set(true);
      this.svc.isOwned(this.setId()).subscribe({
        next: v => this.owned.set(v),
        error: () => {},
      });
      return;
    }
    if (err instanceof HttpErrorResponse && err.status === 404) {
      this.errorMsg.set('This MealSet is no longer available.');
      return;
    }
    this.errorMsg.set('Something went wrong. Please try again.');
  }
}
