// src/app/components/meal-list/meal-list.ts
// Renders the meals inside a MealSet: thumbnail, name, an ingredient-derived
// description, and a macros row. Fed lean Meal rows from GET /api/meal — every
// field is optional and rendered defensively.
import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import { Meal } from '../mealset.models';
import { MealPlaceholderComponent } from '../meal-placeholder/meal-placeholder';

@Component({
  selector: 'app-meal-list',
  standalone: true,
  imports: [MealPlaceholderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="meals">
      @for (m of meals(); track m.id ?? $index) {
        <div class="meal">
          <div class="meal__thumb">
            @if (m.mealImageThumbnail || m.mealImage; as pic) {
              <img [src]="pic" [alt]="m.name || 'Meal'" loading="lazy" />
            } @else {
              <app-meal-placeholder />
            }
          </div>
          <div class="meal__body">
            <h3 class="meal__name">{{ m.name || 'Meal' }}</h3>
            @if (describe(m); as desc) {
              <p class="meal__desc">{{ desc }}</p>
            }
            @if (hasMacros(m)) {
              <div class="macros">
                @if (m.totalCalories != null) {
                  <span class="macro macro--cal">{{ m.totalCalories }} cal</span>
                }
                @if (m.totalProteinG != null) {
                  <span class="macro"><b>{{ round(m.totalProteinG) }}g</b> protein</span>
                }
                @if (m.totalCarbG != null) {
                  <span class="macro"><b>{{ round(m.totalCarbG) }}g</b> carbs</span>
                }
                @if (m.totalFatG != null) {
                  <span class="macro"><b>{{ round(m.totalFatG) }}g</b> fat</span>
                }
                @if (m.totalFiberG != null) {
                  <span class="macro"><b>{{ round(m.totalFiberG) }}g</b> fiber</span>
                }
                @if (m.totalSodiumMg != null) {
                  <span class="macro"><b>{{ round(m.totalSodiumMg) }}mg</b> sodium</span>
                }
              </div>
            }
          </div>
        </div>
      }
    </div>
  `,
  styleUrl: './meal-list.scss',
})
export class MealListComponent {
  readonly meals = input<Meal[]>([]);

  /** Best-available description: the ingredient list, falling back to the meal's
   *  item food names, then the primary protein. */
  describe(m: Meal): string {
    if (m.ingredientNames?.trim()) return m.ingredientNames.trim();
    const items = (m.items ?? [])
      .map(i => i.foodName?.trim())
      .filter((n): n is string => !!n);
    if (items.length) return items.join(', ');
    return m.primaryProteinName?.trim() || '';
  }

  hasMacros(m: Meal): boolean {
    return (
      m.totalCalories != null ||
      m.totalProteinG != null ||
      m.totalCarbG != null ||
      m.totalFatG != null
    );
  }

  round(n: number): number {
    return Math.round(n);
  }
}
