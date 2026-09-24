// src/app/app.ts
// Marketplace shell: a global header (logo, Browse, login/account) and footer
// wrap the routed pages. Standalone, signals, OnPush — mirrors regi-app.
import { Component, ChangeDetectionStrategy, inject, effect } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, take } from 'rxjs';
import { RouterOutlet, RouterLink } from '@angular/router';
import { Router } from '@angular/router';
import { AuthService } from '@auth0/auth0-angular';
import { environment } from '../environments/environment';
import { MealSetService } from './mealsets/mealset.service';
import { NotificationComponent } from './components/notification/notification';

/** appState carried through the silent SSO round-trip. Recovered on failure from
 *  AuthenticationError.appState, on success via the SDK's own navigation. */
interface AuthAppState {
  target?: string;
  connect?: boolean;
  loginHint?: string;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, NotificationComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="shell">
      <header class="shell-header">
        <div class="ms-container shell-header__inner">
          <a routerLink="/" class="brand" aria-label="RegiMenu Marketplace home">
            <img class="brand__logo" src="/images/yeh_logo_dark.png" alt="" />
            <span class="brand__name">RegiMenu Marketplace</span>
          </a>
          <nav class="shell-nav">
            <a routerLink="/mealsets" class="shell-nav__link">MealSets</a>
            @if (isAuthenticated()) {
              <button class="ms-btn ms-btn--ghost shell-nav__btn" (click)="logout()">
                Log out
              </button>
            } @else {
              <button class="ms-btn ms-btn--ghost shell-nav__btn" (click)="login()">
                Log in
              </button>
              <button class="ms-btn ms-btn--primary shell-nav__btn" (click)="signup()">
                Sign up
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
          <span class="shell-footer__brand">RegiMenu Marketplace</span>
          <nav class="shell-footer__links">
            <a routerLink="/mealsets">MealSets</a>
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

  /** Per-tab guard so the silent SSO arrival check (`prompt=none`) runs at most
   *  once per tab — survives reloads (sessionStorage), cleared on tab close. A
   *  `?connect` arrival clears it so the cross-app hand-off always re-checks. */
  private static readonly SSO_CHECKED = 'rm_sso_checked';

  /** Arrival context captured from the entry URL, reused by the heal re-check. */
  private connectArrival = false;
  private arrivalLoginHint?: string;

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

  constructor() {
    // Capture the arrival context from the entry URL once. `?connect` is the
    // cross-app hand-off from regi-app (a signed-in user opening the marketplace);
    // `login_hint` names the user Auth0 should adopt. Both are consumed by the
    // silent check and carried through the round-trip in appState, so they must be
    // read here — after a redirect the callback URL no longer carries them.
    const params = new URLSearchParams(window.location.search);
    this.connectArrival = params.has('connect');
    this.arrivalLoginHint = params.get('login_hint') ?? undefined;

    // `?connect` always forces a fresh SSO check, even on a tab that already ran
    // one, so a cross-app hand-off can adopt the (possibly different) SSO user.
    if (this.connectArrival) sessionStorage.removeItem(AppComponent.SSO_CHECKED);

    // The SDK surfaces token-acquisition and prompt=none callback failures on
    // error$ (handleRedirectCallback rejects an `?error=` callback with an
    // AuthenticationError, caught by the SDK → setError). Two classes matter:
    this.auth.error$.subscribe(err => {
      const e = err as { error?: string; appState?: AuthAppState } | undefined;
      const code = e?.error ?? '';

      // 1. A DEAD refresh token (`invalid_grant`, "Unknown or invalid refresh
      //    token"): cached in localstorage, not in the SDK's rescuable set, so it
      //    fails every authenticated call on every reload. Purge it and silently
      //    re-check rather than dropping the user to a logged-out state.
      if (code === 'invalid_grant') {
        this.healDeadRefreshToken();
        return;
      }

      // 2. The prompt=none silent check found no adoptable tenant SSO session.
      //    appState (recovered from the AuthenticationError) tells us the origin
      //    of the check and where to land.
      if (/login_required|consent_required|interaction_required/.test(code)) {
        const target = e?.appState?.target ?? '/';
        if (e?.appState?.connect) {
          // Cross-app hand-off: the user is expected to be signed in, so fall
          // back to a normal interactive login (no prompt), passing the login
          // hint through so Auth0 pre-fills the right account.
          const hint = e.appState.loginHint;
          this.auth.loginWithRedirect({
            authorizationParams: hint ? { login_hint: hint } : {},
            appState: { target },
          });
        } else {
          // Ordinary anonymous visitor: land on the intended page, no error UI.
          // The SDK already stripped the error params by navigating to '/'.
          void this.router.navigateByUrl(target);
        }
      }
    });

    // Silent SSO arrival check: once auth state resolves, if still anonymous and
    // this tab hasn't checked yet, bounce through /authorize with prompt=none via
    // a TOP-LEVEL redirect (never iframe silent auth). A live tenant SSO session
    // returns a token with zero UI; no session comes back as login_required and is
    // handled above as an anonymous visitor.
    this.auth.isLoading$.pipe(filter(loading => !loading), take(1)).subscribe(() => {
      this.auth.isAuthenticated$.pipe(take(1)).subscribe(isAuth => {
        if (!isAuth) this.runSilentCheck();
      });
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

    // Warm the entitled list once when authenticated so /mealsets can pick
    // shelf-vs-explainer without a flash. Skips if a page already loaded it.
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

  signup(): void {
    this.auth.loginWithRedirect({
      authorizationParams: { screen_hint: 'signup' },
      appState: { target: this.router.url },
    });
  }

  logout(): void {
    this.auth.logout({ logoutParams: { returnTo: window.location.origin } });
  }

  /**
   * The silent SSO arrival check (requirement B): if this tab hasn't checked yet
   * (and no heal owns the redirect), mark it checked and bounce through /authorize
   * with prompt=none. The connect flag + login hint travel in appState so the
   * error handler can recover them after the round-trip.
   */
  private runSilentCheck(): void {
    if (sessionStorage.getItem(AppComponent.SSO_CHECKED)) return;
    if (this.recovering) return; // an invalid_grant heal owns the redirect
    sessionStorage.setItem(AppComponent.SSO_CHECKED, '1');
    this.silentRedirect();
  }

  private silentRedirect(): void {
    const hint = this.arrivalLoginHint;
    this.auth.loginWithRedirect({
      authorizationParams: { prompt: 'none', ...(hint ? { login_hint: hint } : {}) },
      appState: {
        target: AppComponent.cleanTarget(),
        ...(this.connectArrival ? { connect: true } : {}),
        ...(hint ? { loginHint: hint } : {}),
      },
    });
  }

  /**
   * Recover from a dead cached refresh token (`invalid_grant`) WITHOUT leaving
   * the user logged out. Purge the poisoned token locally FIRST (openUrl:false —
   * clears the cache, no redirect), then re-run the silent SSO check: if the
   * tenant SSO cookie is still alive Auth0 returns a fresh token with zero UI;
   * only a truly absent session lands as an anonymous visitor.
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

    const healedAt = Number(sessionStorage.getItem(AppComponent.HEAL_MARKER) ?? 0);
    const looping = healedAt > 0 && Date.now() - healedAt < AppComponent.HEAL_WINDOW_MS;

    // Purge locally first, and only re-check once the purge has COMPLETED, so the
    // logout can't wipe the fresh login transaction the silent check creates.
    this.auth.logout({ openUrl: false }).subscribe({
      complete: () => this.afterPurge(looping),
      error: () => this.afterPurge(looping),
    });
  }

  private afterPurge(looping: boolean): void {
    if (looping) {
      console.warn(
        '[auth] invalid_grant recurred within 60s of a heal attempt — staying ' +
          'anonymous to avoid a redirect loop.',
      );
      return; // the purge above already dropped us to a clean anonymous state
    }
    // Marker written immediately before the redirect so the guard survives it.
    sessionStorage.setItem(AppComponent.HEAL_MARKER, String(Date.now()));
    // Re-run requirement B's silent check: clear the per-tab guard and release the
    // heal latch so the check fires exactly one prompt=none redirect.
    sessionStorage.removeItem(AppComponent.SSO_CHECKED);
    this.recovering = false;
    this.runSilentCheck();
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
