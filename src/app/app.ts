// src/app/app.ts
// Marketplace shell: a global header (logo, Browse, login/account) and footer
// wrap the routed pages. Standalone, signals, OnPush — mirrors regi-app.
import { Component, ChangeDetectionStrategy, inject, computed, effect } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, take } from 'rxjs';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { Router } from '@angular/router';
import { AuthService } from '@auth0/auth0-angular';
import { environment } from '../environments/environment';
import { MealSetService } from './services/mealset.service';
import { NotificationComponent } from './components/notification/notification';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, NotificationComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="shell">
      <header class="shell-header">
        <div class="ms-container shell-header__inner">
          <a routerLink="/" class="brand" aria-label="RegiMenu MealSets home">
            <img class="brand__logo" src="/images/yeh_logo_dark.png" alt="" />
            <span class="brand__name">RegiMenu MealSets</span>
          </a>
          <nav class="shell-nav">
            @if (isOwner()) {
              <a routerLink="/" class="shell-nav__link" routerLinkActive="shell-nav__link--active"
                [routerLinkActiveOptions]="{ exact: true }">My MealSets</a>
            }
            <a routerLink="/browse" class="shell-nav__link">Browse</a>
            @if (isAuthenticated()) {
              <button class="ms-btn ms-btn--ghost shell-nav__btn" (click)="logout()">
                Log out
              </button>
            } @else {
              <button class="ms-btn ms-btn--ghost shell-nav__btn" (click)="login()">
                Log in
              </button>
            }
          </nav>
        </div>
      </header>

      <main class="shell-main">
        <router-outlet />
      </main>

      <footer class="shell-footer">
        <div class="ms-container shell-footer__inner">
          <span class="shell-footer__brand">RegiMenu MealSets</span>
          <nav class="shell-footer__links">
            <a routerLink="/browse">Browse</a>
            <a [href]="signupUrl">Get the RegiMenu app</a>
          </nav>
        </div>
      </footer>

      <app-notification />
    </div>
  `,
  styleUrl: './app.scss',
})
export class AppComponent {
  private auth = inject(AuthService);
  private router = inject(Router);
  private svc = inject(MealSetService);

  /** Marks an in-flight prompt=none reconcile so the error handler can tell a
   *  "no SSO session" failure from unrelated Auth0 errors. */
  private static readonly CONNECT_FLAG = 'ms.connect';

  readonly isAuthenticated = toSignal(this.auth.isAuthenticated$, { initialValue: false });
  readonly signupUrl = environment.signupUrl;

  /** Show the "My MealSets" nav link only for authenticated users who actually
   *  own a set (empty owners see the pitch at `/`, not a shelf). */
  readonly isOwner = computed(() => this.isAuthenticated() && this.svc.entitled().length > 0);

  constructor() {
    // After an Auth0 redirect completes, restore the page the user was on when
    // they triggered login. Guards and the set-detail CTA stash the return
    // target in appState.target.
    this.auth.appState$.subscribe((state: { target?: string } | undefined) => {
      // A reconcile round-trip completed successfully — clear the guard so a
      // later unrelated error can't trigger a spurious interactive login.
      sessionStorage.removeItem(AppComponent.CONNECT_FLAG);
      if (state?.target) {
        void this.router.navigateByUrl(state.target);
      }
    });

    // Cross-app hand-off from regi-app. That app links here with `?connect=1`
    // when a signed-in user opens the marketplace. Because this is a separate
    // origin, mealsets has its own Auth0 cache and may still hold a *stale*
    // session from a prior login on this machine — the SDK sees a valid local
    // token and never notices the current user changed. We can't fix that with
    // getAccessTokenSilently: `useRefreshTokens` makes silent calls use the
    // refresh-token grant, which is pinned to the cached user. The only path
    // that consults the tenant SSO cookie (and thus the *current* identity) is
    // an /authorize round-trip, so we force one with prompt=none.
    const params = new URLSearchParams(window.location.search);
    if (params.has('connect')) {
      const login_hint = params.get('login_hint') ?? undefined;
      sessionStorage.setItem(AppComponent.CONNECT_FLAG, '1');
      this.auth.isLoading$.pipe(filter(loading => !loading), take(1)).subscribe(() => {
        this.auth.loginWithRedirect({
          authorizationParams: { prompt: 'none', login_hint },
          appState: { target: '/' }, // return to a clean URL, dropping ?connect
        });
      });
    }

    // prompt=none returns `login_required` when there is no tenant SSO session
    // to adopt (regi-app never established one, or it expired). The error lands
    // on the return leg, handled by the SDK, and surfaces here — fall back to a
    // normal interactive login so the user can still sign in.
    this.auth.error$.subscribe(err => {
      if (!sessionStorage.getItem(AppComponent.CONNECT_FLAG)) return;
      const code = (err as { error?: string } | undefined)?.error ?? '';
      if (/login_required|interaction_required|consent_required/.test(code)) {
        sessionStorage.removeItem(AppComponent.CONNECT_FLAG);
        this.auth.loginWithRedirect({ appState: { target: '/' } });
      }
    });

    // Warm the entitled list once when authenticated so the nav knows whether
    // to show "My MealSets" from anywhere. Skips if a page already loaded it.
    effect(() => {
      if (this.isAuthenticated() && !this.svc.entitledLoaded()) {
        this.svc.loadEntitled().subscribe({ error: () => {} });
      }
    });
  }

  login(): void {
    this.auth.loginWithRedirect({
      appState: { target: this.router.url },
    });
  }

  logout(): void {
    this.auth.logout({ logoutParams: { returnTo: window.location.origin } });
  }
}
