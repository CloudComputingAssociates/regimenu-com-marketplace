// src/app/components/my-mealsets/my-mealsets.ts
// The "My MealSets" shelf: the caller's owned sets as full visual cards, newest
// purchase first. Visuals resolve against the catalog store; a set that has left
// the catalog (author deactivated) falls back to its summary fields. Card styles
// are the shared global .card/.grid classes. Assumes the entitled list is
// already loaded by the host (Home); it loads the catalog itself (cached).
import { Component, ChangeDetectionStrategy, inject, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MealSetService } from '../mealset.service';
import { MealSetCatalogEntry, MealSetSummary } from '../mealset.models';
import { MealPlaceholderComponent } from '../meal-placeholder/meal-placeholder';

interface ShelfItem {
  summary: MealSetSummary;
  entry?: MealSetCatalogEntry;
}

@Component({
  selector: 'app-my-mealsets',
  standalone: true,
  imports: [RouterLink, MealPlaceholderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="grid">
      @for (item of shelf(); track item.summary.mealSetId) {
        <a class="card card--shelf" [routerLink]="['/mealsets/set', item.summary.mealSetId]">
          <div class="card__media">
            @if (item.entry?.mealSetPic1; as pic) {
              <img class="card__img" [src]="pic" [alt]="cardName(item)" loading="lazy" />
            } @else {
              <app-meal-placeholder class="card__noimg" />
            }
            <span class="card__hint">Click for details</span>
          </div>
          <div class="card__body">
            <div class="card__titlerow">
              <h2 class="card__name">{{ cardName(item) }}</h2>
              @if (item.entry; as e) {
                <span class="card__price" [class.card__price--free]="e.price === 0">
                  {{ priceLabel(e.price) }}
                </span>
              }
            </div>
            @if (item.entry?.authorName; as author) {
              <p class="card__author">by {{ author }}</p>
            }
            @if (cardGenres(item).length) {
              <div class="card__genres">
                @for (g of cardGenres(item); track g) {
                  <span class="card__genre">{{ g }}</span>
                }
              </div>
            }
            <p class="card__added">{{ formatAdded(item.summary.purchasedAt) }}</p>
          </div>
        </a>
      }
    </div>
  `,
})
export class MyMealsetsComponent {
  private svc = inject(MealSetService);

  /** Owned sets in the entitled list's order (newest purchase first), each
   *  paired with its resolved catalog entry (re-resolves as the catalog loads). */
  readonly shelf = computed<ShelfItem[]>(() => {
    const entries = this.svc.entries();
    return this.svc.entitled().map(summary => ({
      summary,
      entry: entries.find(e => e.mealSetId === summary.mealSetId),
    }));
  });

  constructor() {
    // Catalog supplies the card visuals; cached if already loaded.
    this.svc.loadCatalog().subscribe({ error: () => {} });
  }

  cardName(item: ShelfItem): string {
    return item.entry?.name ?? item.summary.name;
  }

  priceLabel(price: number): string {
    return price === 0 ? 'Free' : `$${price.toFixed(2)}`;
  }

  cardGenres(item: ShelfItem): string[] {
    return item.entry?.genres ?? item.summary.genres ?? [];
  }

  /** "Added Mon D, YYYY" from the ISO purchasedAt; empty if unparseable. */
  formatAdded(iso: string | undefined): string {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return `Added ${d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })}`;
  }
}
