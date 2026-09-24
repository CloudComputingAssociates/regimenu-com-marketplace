import { Routes } from '@angular/router';
import { authGuardFn } from '@auth0/auth0-angular';

// Route map for the RegiMenu Marketplace.
//  - `/`                        marketplace storefront (departments grid)
//  - `/mealsets`                MealSets section: explainer/shelf intro + catalog
//  - `/mealsets/set/:id`        per-set detail (public; deep-linkable)
//  - `/mealsets/purchase/*`     post-purchase flow (auth-required)
//  - unknown → the storefront
//
// The browser tab reads "RegiMenu Marketplace" on every route (applied by
// Angular's built-in TitleStrategy), paired with the RegiMenu logo favicon.
export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    title: 'RegiMenu Marketplace',
    loadComponent: () => import('./home/home').then(m => m.HomeComponent),
  },
  {
    path: 'mealsets',
    title: 'RegiMenu Marketplace',
    // State-dependent intro (explainer for newcomers, "My MealSets" shelf for
    // owners) above the catalog.
    loadComponent: () => import('./mealsets/mealsets').then(m => m.MealsetsComponent),
  },
  {
    path: 'mealsets/set/:id',
    title: 'RegiMenu Marketplace',
    loadComponent: () =>
      import('./mealsets/set-detail/set-detail').then(m => m.SetDetailComponent),
  },
  {
    path: 'mealsets/purchase/pending',
    canActivate: [authGuardFn],
    title: 'RegiMenu Marketplace',
    loadComponent: () =>
      import('./mealsets/purchase-pending/purchase-pending').then(m => m.PurchasePendingComponent),
  },
  {
    path: 'mealsets/purchase/delivered',
    canActivate: [authGuardFn],
    title: 'RegiMenu Marketplace',
    loadComponent: () =>
      import('./mealsets/purchase-delivered/purchase-delivered').then(
        m => m.PurchaseDeliveredComponent,
      ),
  },
  // Unknown paths fall back to the storefront.
  { path: '**', redirectTo: '' },
];
