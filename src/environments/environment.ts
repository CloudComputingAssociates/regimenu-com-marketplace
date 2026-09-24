// src/environments/environment.ts
// DEVELOPMENT / local environment. FILL_ME values are placeholders — the repo
// owner fills the real values here. Production values live in environment.prod.ts
// (swapped in at build time by the `production` configuration in angular.json).
//
// NOTE: `apiUrl` must include the `/api` suffix — services append resource paths
// like `${apiUrl}/mealset/catalog`, mirroring regi-app.
export const environment = {
  production: false,
  apiUrl: 'FILL_ME', // e.g. https://api.regimenu.net/api
  auth0: {
    domain: 'login.regimenu.com', // Auth0 custom domain (same tenant as regi-app)
    clientId: 'FILL_ME', // Auth0 SPA application client id (same app as regi-app)
    audience: 'FILL_ME', // e.g. https://api.regimenu.net
  },
  cockpitUrl: 'https://app.regimenu.com', // post-purchase / owner destinations only
  signupUrl: 'https://signup.regimenu.com', // public "Get the RegiMenu app" funnel (NYI)
};
