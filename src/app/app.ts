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

  /** One-shot in-memory latch so a burst of concurrent invalid_grant failures in
   *  a single page load triggers exactly one purge+redirect. */
  private recovering = false;

  /** Loop guard that SURVIVES the heal redirect (the in-memory latch resets on
   *  reload): a timestamp written just before the redirect, plus its window. If
   *  invalid_grant recurs within the window, re-auth isn't helping — stop. */
  private static readonly HEAL_MARKER = 'rm_rt_heal_at';
  private static readonly HEAL_WINDOW_MS = 60_000;

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

    // The SDK surfaces token-acquisition failures on error$. Two classes matter:
    this.auth.error$.subscribe(err => {
      const code = (err as { error?: string } | undefined)?.error ?? '';
      const connecting = !!sessionStorage.getItem(AppComponent.CONNECT_FLAG);

      // 1. A DEAD refresh token (`invalid_grant`, "Unknown or invalid refresh
      //    token"): cached in localstorage, not in the SDK's rescuable set, so it
      //    fails every authenticated call on every reload. Silently swap it for a
      //    fresh token rather than dropping the user to a logged-out state.
      if (code === 'invalid_grant') {
        this.healDeadRefreshToken();
        return;
      }

      // 2. prompt=none found no tenant SSO session to adopt (`login_required` et
      //    al.) during a ?connect reconcile — fall back to a normal interactive
      //    login so the user can still sign in.
      if (connecting && /login_required|interaction_required|consent_required/.test(code)) {
        sessionStorage.removeItem(AppComponent.CONNECT_FLAG);
        this.auth.loginWithRedirect({ appState: { target: '/' } });
      }
    });

    // After a heal round-trip lands us back authenticated, confirm a token is
    // genuinely obtainable and clear the loop-guard marker so a FUTURE dead token
    // can heal (the window guard won't wrongly suppress it). A failure here just
    // re-enters healDeadRefreshToken via error$, where the window guard applies.
    this.auth.isAuthenticated$.pipe(filter(Boolean), take(1)).subscribe(() => {
      this.auth.getAccessTokenSilently().subscribe({
        next: () => sessionStorage.removeItem(AppComponent.HEAL_MARKER),
        error: () => {},
      });
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

  /**
   * Recover from a dead cached refresh token (`invalid_grant`) WITHOUT leaving
   * the user logged out. Purge the poisoned token locally, then ALWAYS bounce
   * through /authorize to mint a fresh one. No prompt override: if the tenant SSO
   * cookie is still alive Auth0 returns a token with zero UI (the user stays
   * signed in and lands back where they were); only a truly absent session shows
   * the login screen.
   *
   * Two-layer loop protection: the in-memory `recovering` latch collapses a burst
   * of parallel failures in one page load into a single purge+redirect, and the
   * sessionStorage HEAL_MARKER survives the redirect — if invalid_grant recurs
   * within HEAL_WINDOW_MS, re-auth clearly isn't helping, so we stay anonymous
   * and warn instead of looping.
   */
  private healDeadRefreshToken(): void {
    if (this.recovering) return;
    this.recovering = true;
    sessionStorage.removeItem(AppComponent.CONNECT_FLAG);

    const target = AppComponent.cleanTarget();
    const healedAt = Number(sessionStorage.getItem(AppComponent.HEAL_MARKER) ?? 0);
    const looping = healedAt > 0 && Date.now() - healedAt < AppComponent.HEAL_WINDOW_MS;

    // Purge locally first (openUrl:false — clears the cache, no redirect), and
    // only redirect once the purge has COMPLETED, so the logout can't wipe the
    // fresh login transaction loginWithRedirect is about to create.
    this.auth.logout({ openUrl: false }).subscribe({
      complete: () => this.afterPurge(looping, target),
      error: () => this.afterPurge(looping, target),
    });
  }

  private afterPurge(looping: boolean, target: string): void {
    if (looping) {
      console.warn(
        '[auth] invalid_grant recurred within 60s of a heal attempt — staying ' +
          'anonymous to avoid a redirect loop.',
      );
      return; // the purge above already dropped us to a clean anonymous state
    }
    // Marker written immediately before the redirect so the guard survives it.
    sessionStorage.setItem(AppComponent.HEAL_MARKER, String(Date.now()));
    this.auth.loginWithRedirect({ appState: { target } });
  }

  /** Current path+query for the post-heal return, minus transient connect/OAuth
   *  callback params so we never bounce back into ?connect or the /authorize
   *  callback. */
  private static cleanTarget(): string {
    const url = new URL(window.location.href);
    for (const p of ['connect', 'login_hint', 'code', 'state', 'error', 'error_description', 'iss']) {
      url.searchParams.delete(p);
    }
    const qs = url.searchParams.toString();
    return url.pathname + (qs ? `?${qs}` : '');
  }
}
