// This build's backend environment (spec 2 Amendment 1 A2): fixed when the app
// is built, from the EXPO_PUBLIC_TABLESIDE_* settings that Expo writes into the
// bundle (docs/environments.md). Nothing at run time can point a build at
// another environment's endpoints, and the backend refuses a request that names
// another environment, so a retired beta build can never reach production.

import { type BackendEnvironment, backendEnvironment } from '@tableside/account/environment';

export function buildBackend(): BackendEnvironment {
  return backendEnvironment({
    // Each read must be spelled out in full for Expo to inline it.
    name: process.env.EXPO_PUBLIC_TABLESIDE_ENVIRONMENT,
    url: process.env.EXPO_PUBLIC_TABLESIDE_SUPABASE_URL,
    publishableKey: process.env.EXPO_PUBLIC_TABLESIDE_SUPABASE_PUBLISHABLE_KEY,
  });
}
