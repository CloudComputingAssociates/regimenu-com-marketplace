// src/app/services/mealset.service.ts
//
// The marketplace's single data client + catalog store.
//
// The public catalog is fetched ONCE and cached in a signal store — /browse and
// /set/:id both read from it (deep-linking to /set/:id triggers the same one-shot
// load). All other calls are per-action and require Auth0 (the interceptor
// attaches the JWT automatically; the route guard forces login before the
// auth'd routes render).
import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, tap, shareReplay, finalize } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import {
  MealSetCatalogEntry,
  MealSetCatalogResponse,
  CatalogQuery,
  MealSetSummary,
  OwnedResponse,
  AcquireResponse,
  CheckoutResponse,
  RedownloadResponse,
  Meal,
} from './mealset.models';

@Injectable({ providedIn: 'root' })
export class MealSetService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiUrl}/mealset`;
  private apiUrl = environment.apiUrl;

  // ---- Catalog store (public) -----------------------------------------------
  private readonly _entries = signal<MealSetCatalogEntry[]>([]);
  private readonly _genres = signal<string[]>([]);
  private readonly _loading = signal(false);
  private readonly _loaded = signal(false);
  private readonly _error = signal<string | null>(null);

  readonly entries = this._entries.asReadonly();
  readonly genres = this._genres.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly loaded = this._loaded.asReadonly();
  readonly error = this._error.asReadonly();

  /** In-flight shared request so concurrent callers (browse + a deep-link race)
   *  don't fire two catalog fetches. */
  private catalog$?: Observable<MealSetCatalogResponse>;

  /**
   * GET /api/mealset/catalog (PUBLIC — no token required).
   * Fetches once and caches into the signal store. Subsequent calls return the
   * cached data immediately unless `force` is set. Client-side filtering (genre,
   * sort) is done in the components off the cached `entries`, so the optional
   * server query params are only used when a caller explicitly asks.
   */
  loadCatalog(force = false, query?: CatalogQuery): Observable<MealSetCatalogResponse> {
    if (this._loaded() && !force && !query) {
      return of({ entries: this._entries(), genres: this._genres() });
    }
    if (this.catalog$ && !force) {
      return this.catalog$;
    }

    let params = new HttpParams();
    if (query?.genre) params = params.set('genre', query.genre);
    if (query?.minPrice != null) params = params.set('minPrice', String(query.minPrice));
    if (query?.maxPrice != null) params = params.set('maxPrice', String(query.maxPrice));

    this._loading.set(true);
    this._error.set(null);

    this.catalog$ = this.http
      .get<MealSetCatalogResponse>(`${this.baseUrl}/catalog`, { params })
      .pipe(
        tap(res => {
          this._entries.set(res.entries ?? []);
          this._genres.set(res.genres ?? []);
          this._loaded.set(true);
        }),
        finalize(() => {
          this._loading.set(false);
          this.catalog$ = undefined;
        }),
        shareReplay(1),
      );

    // Surface a friendly error into the store; rethrow for the caller too.
    return new Observable<MealSetCatalogResponse>(sub => {
      this.catalog$!.subscribe({
        next: v => sub.next(v),
        error: err => {
          this._error.set('We could not load the MealSets catalog. Please try again.');
          sub.error(err);
        },
        complete: () => sub.complete(),
      });
    });
  }

  /** Resolve a single entry by id from the cached catalog, loading the catalog
   *  first if this was a deep-link (no prior /browse visit). */
  getEntry(id: number): Observable<MealSetCatalogEntry | undefined> {
    const found = this._entries().find(e => e.mealSetId === id);
    if (found) return of(found);
    return this.loadCatalog().pipe(map(res => res.entries.find(e => e.mealSetId === id)));
  }

  /** Synchronous peek into the store (used to seed a page before async resolve). */
  peekEntry(id: number): MealSetCatalogEntry | undefined {
    return this._entries().find(e => e.mealSetId === id);
  }

  // ---- Entitlements (Auth0) -------------------------------------------------
  private readonly _entitled = signal<MealSetSummary[]>([]);
  private readonly _entitledLoaded = signal(false);
  readonly entitled = this._entitled.asReadonly();
  /** True once loadEntitled has resolved at least once — lets callers skip a
   *  refetch and decide shelf-vs-pitch without a flash. */
  readonly entitledLoaded = this._entitledLoaded.asReadonly();
  readonly entitledIds = computed(() => new Set(this._entitled().map(s => s.mealSetId)));

  /** In-flight shared request so concurrent warmers (the app shell + a page both
   *  hydrating on the same login) collapse into ONE fetch and ONE silent-token
   *  acquisition. Fewer simultaneous refresh-token grants is also kinder to
   *  Auth0 refresh-token rotation. Mirrors the catalog store above. */
  private entitled$?: Observable<MealSetSummary[]>;

  /** GET /api/mealset — the caller's owned sets, newest purchase first. Only
   *  call when authenticated. Cached + de-duped; pass `force` to refetch after an
   *  acquire/checkout changes ownership. */
  loadEntitled(force = false): Observable<MealSetSummary[]> {
    if (this._entitledLoaded() && !force) {
      return of(this._entitled());
    }
    if (this.entitled$ && !force) {
      return this.entitled$;
    }
    this.entitled$ = this.http.get<MealSetSummary[]>(this.baseUrl).pipe(
      tap(sets => {
        this._entitled.set(sets ?? []);
        this._entitledLoaded.set(true);
      }),
      finalize(() => {
        this.entitled$ = undefined;
      }),
      shareReplay(1),
    );
    return this.entitled$;
  }

  /** GET /api/mealset/{id}/owned — authoritative single-set ownership check. */
  isOwned(id: number): Observable<boolean> {
    return this.http
      .get<OwnedResponse>(`${this.baseUrl}/${id}/owned`)
      .pipe(map(r => r.owned));
  }

  // ---- Acquisition (Auth0) --------------------------------------------------
  /** POST /api/mealset/{id}/acquire — FREE sets (price === 0), no body.
   *  409 = paid/inactive, 404 = missing (surface to caller). */
  acquire(id: number): Observable<AcquireResponse> {
    return this.http.post<AcquireResponse>(`${this.baseUrl}/${id}/acquire`, {});
  }

  /** POST /api/mealset/{id}/checkout — PAID sets (price > 0), no body.
   *  Returns a Stripe url the browser should be redirected to. */
  checkout(id: number): Observable<CheckoutResponse> {
    return this.http.post<CheckoutResponse>(`${this.baseUrl}/${id}/checkout`, {});
  }

  /** POST /api/mealset/{id}/redownload — re-materialize only the MISSING meals
   *  from an owned set into the notebook. Idempotent; returns how many were added.
   *  404 = the caller has no purchase of this set (surface to caller). */
  redownload(id: number): Observable<RedownloadResponse> {
    return this.http.post<RedownloadResponse>(`${this.baseUrl}/${id}/redownload`, {});
  }

  // ---- Set meals (Auth0, owners only) ---------------------------------------
  /** GET /api/meal?mealSetIds={id} — the endpoint returns a UNION of the
   *  caller's OWN meals plus this set's meals, so we keep only the rows the
   *  server tags with this set's id (`mealSetId`). Used for the set-detail
   *  "What's inside" list and the delivered-page count. limit=100 lifts the
   *  default 20-row cap so large sets aren't truncated. */
  getSetMeals(id: number): Observable<Meal[]> {
    return this.http
      .get<Meal[]>(`${this.apiUrl}/meal`, {
        params: { mealSetIds: String(id), limit: '100' },
      })
      .pipe(map(meals => (meals ?? []).filter(m => m.mealSetId === id)));
  }
}
