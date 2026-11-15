// Apple's and Google's revocable grants (spec 2, *Deletion*; #52 review): the
// authorization code a provider gives the app is exchanged here for the
// provider's refresh token, which is kept sealed (AES-GCM, with a key only the
// functions hold) and revoked at permanent deletion. Nothing here logs a code,
// token, claim or key.
//
// Each provider's settings come from the function's environment, where
// <PROVIDER> is Auth's name for it (APPLE, GOOGLE, or KEYCLOAK for a local
// stack's test identity provider):
//   TABLESIDE_GRANT_<PROVIDER>_TOKEN_URL     its token endpoint (Apple https://appleid.apple.com/auth/token,
//                                            Google https://oauth2.googleapis.com/token)
//   TABLESIDE_GRANT_<PROVIDER>_REVOKE_URL    its revocation endpoint (Apple https://appleid.apple.com/auth/revoke,
//                                            Google https://oauth2.googleapis.com/revoke)
//   TABLESIDE_GRANT_<PROVIDER>_CLIENT_ID     the client a native flow's code is issued to (Apple: the bundle ID;
//                                            Google: the server client ID)
//   TABLESIDE_GRANT_<PROVIDER>_WEB_CLIENT_ID the client a browser flow's code is issued to, when it differs
//                                            (Apple: the Services ID); the native client otherwise
//   TABLESIDE_GRANT_<PROVIDER>_CLIENT_SECRET a client secret (Google, the test provider), or, for Apple, a
//                                            client secret made here from:
//   TABLESIDE_GRANT_APPLE_TEAM_ID, TABLESIDE_GRANT_APPLE_KEY_ID, TABLESIDE_GRANT_APPLE_PRIVATE_KEY (PKCS #8 PEM)
// and the sealing key, TABLESIDE_PROVIDER_GRANT_KEY (32 random bytes, base64).
// A provider without settings holds no grant: its identities are reported as
// a provider exception at deletion, never as revoked. Real credentials are
// launch gate 3's (#109, docs/environments.md).

import { verifyIdToken } from './id-token.ts';

declare const Deno: { env: { get(name: string): string | undefined } };

interface GrantConfig {
  readonly tokenUrl: string;
  readonly revokeUrl: string;
  /** The client for a native or a browser flow's codes. */
  readonly clientId: (flow: Flow) => string;
  readonly clientSecret: (clientId: string) => Promise<string>;
}

/** How the code reached the app: a native sheet, or the system browser (Apple's web flow, the web account page). */
export type Flow = 'native' | 'web';

function grantConfig(provider: string): GrantConfig | null {
  if (!/^[a-z]+$/.test(provider)) return null;
  const setting = (name: string) => Deno.env.get(`TABLESIDE_GRANT_${provider.toUpperCase()}_${name}`) ?? '';
  const tokenUrl = setting('TOKEN_URL');
  const revokeUrl = setting('REVOKE_URL');
  const native = setting('CLIENT_ID');
  const web = setting('WEB_CLIENT_ID') || native;
  const clientId = (flow: Flow) => (flow === 'web' ? web : native);
  const staticSecret = setting('CLIENT_SECRET');
  const apple = provider === 'apple' ? { team: setting('TEAM_ID'), key: setting('KEY_ID'), pem: setting('PRIVATE_KEY') } : null;
  if (!tokenUrl || !revokeUrl || !native) return null;
  if (staticSecret) return { tokenUrl, revokeUrl, clientId, clientSecret: () => Promise.resolve(staticSecret) };
  if (apple?.team && apple.key && apple.pem) return { tokenUrl, revokeUrl, clientId, clientSecret: (client) => appleClientSecret(apple.team, apple.key, apple.pem, client) };
  return null;
}

/** Whether a provider's grants can be captured and revoked here. */
export const grantsConfigured = (provider: string): boolean => grantConfig(provider) !== null && sealingKey() !== null;

/** What a grant holds: the provider's refresh token and the client it was issued to (revocation names the same client). */
export interface Grant {
  readonly refreshToken: string;
  readonly clientId: string;
}

/**
 * Exchanges an authorization code for the provider's refresh token, and the
 * subject of the identity it is for (from the ID token the exchange answers
 * with, verified as any). Null when the provider refused, or answered without
 * a refresh token.
 */
export async function exchangeCode(provider: string, code: string, flow: Flow): Promise<{ readonly subject: string; readonly grant: Grant } | null> {
  const config = grantConfig(provider);
  if (!config) return null;
  const clientId = config.clientId(flow);
  const response = await fetch(config.tokenUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'authorization_code', code, client_id: clientId, client_secret: await config.clientSecret(clientId) }),
  });
  const answer = (await response.json().catch(() => null)) as { refresh_token?: unknown; id_token?: unknown } | null;
  if (!response.ok || typeof answer?.refresh_token !== 'string' || typeof answer.id_token !== 'string') return null;
  const claims = await verifyIdToken(provider, answer.id_token);
  return claims ? { subject: claims.sub, grant: { refreshToken: answer.refresh_token, clientId } } : null;
}

/** Revokes a grant with its provider. True when the provider confirmed (or it was already invalid there). */
export async function revokeGrant(provider: string, grant: Grant): Promise<boolean> {
  const config = grantConfig(provider);
  if (!config) return false;
  const response = await fetch(config.revokeUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      token: grant.refreshToken,
      token_type_hint: 'refresh_token',
      client_id: grant.clientId,
      client_secret: await config.clientSecret(grant.clientId),
    }),
  });
  await response.body?.cancel();
  // Google answers 400 invalid_token for a token already revoked: nothing is left to revoke.
  return response.ok || (provider === 'google' && response.status === 400);
}

// ---------------------------------------------------------------------------
// Sealing
// ---------------------------------------------------------------------------

function sealingKey(): Uint8Array<ArrayBuffer> | null {
  const text = Deno.env.get('TABLESIDE_PROVIDER_GRANT_KEY') ?? '';
  try {
    const bytes = Uint8Array.from(atob(text), (character) => character.charCodeAt(0));
    return bytes.length === 32 ? bytes : null;
  } catch {
    return null;
  }
}

const aesKey = (raw: Uint8Array<ArrayBuffer>, usage: 'encrypt' | 'decrypt') => crypto.subtle.importKey('raw', raw, 'AES-GCM', false, [usage]);
const toBase64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const fromBase64 = (text: string) => Uint8Array.from(atob(text), (character) => character.charCodeAt(0));

/** A grant sealed for the database: version, IV and ciphertext, base64. Null without a sealing key. */
export async function seal(grant: Grant): Promise<string | null> {
  const raw = sealingKey();
  if (!raw) return null;
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plain = new TextEncoder().encode(JSON.stringify(grant));
  const sealed = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await aesKey(raw, 'encrypt'), plain));
  return `v1.${toBase64(iv)}.${toBase64(sealed)}`;
}

/** The grant a sealed one holds, or null when it can't be opened with this key. */
export async function unseal(sealed: string): Promise<Grant | null> {
  const raw = sealingKey();
  const [version, iv, data] = sealed.split('.');
  if (!raw || version !== 'v1' || !iv || !data) return null;
  try {
    const opened = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromBase64(iv) }, await aesKey(raw, 'decrypt'), fromBase64(data));
    const grant = JSON.parse(new TextDecoder().decode(opened)) as Partial<Grant>;
    return typeof grant.refreshToken === 'string' && typeof grant.clientId === 'string' ? { refreshToken: grant.refreshToken, clientId: grant.clientId } : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Apple's client secret
// ---------------------------------------------------------------------------

const base64url = (bytes: Uint8Array) => toBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

/** Apple's client secret: an ES256 JWT signed with the team's Sign in with Apple key, good for five minutes. */
async function appleClientSecret(teamId: string, keyId: string, pem: string, clientId: string): Promise<string> {
  const body = pem.replace(/-----(BEGIN|END) PRIVATE KEY-----/g, '').replace(/\s+/g, '');
  const key = await crypto.subtle.importKey('pkcs8', fromBase64(body), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const now = Math.floor(Date.now() / 1000);
  const encode = (value: unknown) => base64url(new TextEncoder().encode(JSON.stringify(value)));
  const unsigned = `${encode({ alg: 'ES256', kid: keyId })}.${encode({ iss: teamId, iat: now, exp: now + 300, aud: 'https://appleid.apple.com', sub: clientId })}`;
  const signature = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(unsigned)));
  return `${unsigned}.${base64url(signature)}`;
}
