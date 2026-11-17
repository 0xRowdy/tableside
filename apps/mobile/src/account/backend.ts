// Spec 2 Amendment 1 A2

import { type BackendEnvironment, backendEnvironment } from '@tableside/account/environment';

export function buildBackend(): BackendEnvironment {
  return backendEnvironment({
    name: process.env.EXPO_PUBLIC_TABLESIDE_ENVIRONMENT,
    url: process.env.EXPO_PUBLIC_TABLESIDE_SUPABASE_URL,
    publishableKey: process.env.EXPO_PUBLIC_TABLESIDE_SUPABASE_PUBLISHABLE_KEY,
  });
}
