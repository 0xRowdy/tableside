// The web account page's entry (#106): the backend this build was made for,
// and the browser's own network, storage, randomness and Global Privacy
// Control signal.

import { PROVIDER_AUTHORIZE_URLS, type WebProvider, type WebProviderSettings, backendEnvironment, createWebAccount } from '@tableside/account/web';

import { mountAccountPage } from './page';

const backend = backendEnvironment({
  name: import.meta.env.TABLESIDE_WEB_ENVIRONMENT,
  url: import.meta.env.TABLESIDE_WEB_SUPABASE_URL,
  publishableKey: import.meta.env.TABLESIDE_WEB_SUPABASE_PUBLISHABLE_KEY,
});

/** Web Storage, or memory when the browser refuses it (a private window, blocked site data). */
function storage(area: () => Storage): Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> {
  try {
    const store = area();
    const probe = 'tableside.probe';
    store.setItem(probe, probe);
    store.removeItem(probe);
    return store;
  } catch {
    const memory = new Map<string, string>();
    return { getItem: (key) => memory.get(key) ?? null, setItem: (key, value) => void memory.set(key, value), removeItem: (key) => void memory.delete(key) };
  }
}

/** Each provider this build has a client ID for: Apple and Google sign-in through their web pages. */
const clientIds: Record<WebProvider, string | undefined> = {
  apple: import.meta.env.TABLESIDE_WEB_APPLE_CLIENT_ID,
  google: import.meta.env.TABLESIDE_WEB_GOOGLE_CLIENT_ID,
};
const providers: Partial<Record<WebProvider, WebProviderSettings>> = {};
for (const provider of ['apple', 'google'] as const) {
  const clientId = clientIds[provider];
  if (clientId) providers[provider] = { authorizeUrl: PROVIDER_AUTHORIZE_URLS[provider], clientId };
}

const account = createWebAccount({
  backend,
  fetch: (input, init) => fetch(input, init),
  session: storage(() => sessionStorage),
  lasting: storage(() => localStorage),
  randomBytes: (count) => crypto.getRandomValues(new Uint8Array(count)),
  globalPrivacyControl: () => (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true,
  providers,
});

const main = document.getElementById('page');
if (main) {
  void mountAccountPage(main, account, {
    query: () => window.location.search,
    go: (url) => window.location.assign(url),
    // The page is one document at the root of its site: a provider's return leaves no query behind.
    clearQuery: () => window.history.replaceState(null, '', window.location.pathname),
  });
}
