import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZoneChangeDetection,
} from '@angular/core';
import { provideRouter, withInMemoryScrolling } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAuth0, authHttpInterceptorFn } from '@auth0/auth0-angular';
import { routes } from './app.routes';
import { environment } from '../environments/environment';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes, withInMemoryScrolling({ scrollPositionRestoration: 'top' })),
    provideHttpClient(withInterceptors([authHttpInterceptorFn])),
    provideAuth0({
      domain: environment.auth0.domain,
      clientId: environment.auth0.clientId,
      authorizationParams: {
        redirect_uri: window.location.origin,
        audience: environment.auth0.audience,
      },
      useRefreshTokens: true,
      cacheLocation: 'localstorage',
      httpInterceptor: {
        // Attach the JWT to every authenticated API call, but NEVER to the
        // PUBLIC catalog. The catalog needs no token, and routing it through the
        // interceptor forces a silent token fetch first — so a stale/invalid
        // cached refresh token (`invalid_grant`, "Unknown or invalid refresh
        // token") makes the public catalog fail even though it should always
        // load. `allowAnonymous` can't save us here: it only rescues a fixed set
        // of codes (login_required, missing_refresh_token, …) and invalid_grant
        // is not one of them. The only safe move is to keep the catalog out of
        // the interceptor entirely, which the uriMatcher does by matching every
        // API url EXCEPT the catalog path. Auth on protected routes is enforced
        // by the route guard, not here.
        allowedList: [
          {
            uriMatcher: uri =>
              uri.startsWith(`${environment.apiUrl}/`) &&
              !uri.startsWith(`${environment.apiUrl}/mealset/catalog`),
            allowAnonymous: true,
          },
        ],
      },
    }),
  ],
};
