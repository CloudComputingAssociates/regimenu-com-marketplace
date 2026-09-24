// src/app/models/mealset.models.ts
// Client-side types for the MealSets marketplace, transcribed from the API
// contract. IDs are numeric (matching regi-app's MealSet ids); route params are
// strings and are coerced at the boundary.

/** A single marketplace listing. The catalog is ALSO the per-set detail source —
 *  there is no GET /mealset/{id}, so /set/:id resolves an entry from this shape. */
export interface MealSetCatalogEntry {
  mealSetId: number;
  name: string;
  description?: string;
  genres: string[]; // always present; [] = uncategorized
  price: number; // dollars; 0 === free
  mealCount?: number; // number of meals in the set; rendered next to the name when present

  mealSetPic1?: string;
  mealSetPic2?: string;
  mealSetPic3?: string;
  mealSetPic4?: string;
  mealSetVideo1?: string;
  authorName?: string;
  authorBio?: string;
  authorCredentials?: string;
  authorPic?: string;
  backLink?: string;
  backLinkPhoto?: string;
}

/** GET /api/mealset/catalog (PUBLIC). */
export interface MealSetCatalogResponse {
  entries: MealSetCatalogEntry[];
  genres: string[];
}

/** Optional catalog query filters. */
export interface CatalogQuery {
  genre?: string;
  minPrice?: number;
  maxPrice?: number;
}

/** GET /api/mealset (Auth0) — the caller's owned sets, ordered newest-purchase
 *  first. `purchasedAt` is an ISO date-time. `genres` mirrors the catalog's
 *  genres[] and is used for the shelf fallback when a set has left the catalog. */
export interface MealSetSummary {
  mealSetId: number;
  name: string;
  genres?: string[];
  purchasedAt: string;
}

/** GET /api/mealset/{id}/owned (Auth0). */
export interface OwnedResponse {
  owned: boolean;
}

/** POST /api/mealset/{id}/acquire (Auth0) — free sets. */
export interface AcquireResponse {
  mealSetId: number;
  entitled: true;
  acquired: boolean;
}

/** POST /api/mealset/{id}/checkout (Auth0) — paid sets. */
export interface CheckoutResponse {
  url: string;
}

/** POST /api/mealset/{id}/redownload (Auth0) — re-materializes only MISSING
 *  meals from an owned set back into the notebook (idempotent; kept/edited meals
 *  are untouched). 404 when the caller has no purchase of the set. */
export interface RedownloadResponse {
  materializedCount: number;
}

/** GET /api/meal?mealSetIds={id} (Auth0, owners only). Fields mirror regi-api's
 *  meal.schema Meal. The list response is "lean" — macro TOTALS are present, but
 *  item-level detail (items[], ingredientNames) may be absent, so those are
 *  optional and rendered defensively. */
export interface Meal {
  id?: number;
  name?: string;
  /** Set this meal was sourced from in a set-filtered (mealSetIds) list; absent
   *  for the caller's own meals. Used to keep ONLY this set's meals out of the
   *  union the endpoint returns. */
  mealSetId?: number | null;
  mealImage?: string;
  mealImageThumbnail?: string;
  primaryProteinName?: string | null;
  ingredientNames?: string;
  totalCalories?: number;
  totalProteinG?: number;
  totalFatG?: number;
  totalCarbG?: number;
  totalFiberG?: number;
  totalSodiumMg?: number;
  items?: { foodName?: string }[];
  [key: string]: unknown;
}
