// src/environments/environment.prod.ts
// PRODUCTION environment. Same Auth0 tenant/app + regi-api as regi-app, so these
// mirror regi-app's production values. `apiUrl` includes the `/api` suffix.
export const environment = {
  production: true,
  apiUrl: 'https://api.regimenu.net/api',
  auth0: {
    domain: 'login.regimenu.com',
    clientId: '9KHWGCfSSg9wUr1oREiUYIgP15EDIppJ',
    audience: 'https://api.regimenu.net',
  },
  cockpitUrl: 'https://app.regimenu.com', // post-purchase / owner destinations only
  signupUrl: 'https://signup.regimenu.com', // public "Get the RegiMenu app" funnel (NYI)
};
