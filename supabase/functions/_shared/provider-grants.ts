// Spec 2 Deletion; #109; docs/environments.md

import { verifyIdToken } from './id-token.ts';

declare const Deno: { env: { get(name: string): string | undefined } };

interface GrantConfig {
  readonly tokenUrl: string;
  readonly revokeUrl: string;
  readonly clientId: (flow: Flow) => string;
  readonly clientSecret: (clientId: string) => Promise<string>;
}

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

export const grantsConfigured = (provider: string): boolean => grantConfig(provider) !== null && sealingKey() !== null;

export interface Grant {
  readonly refreshToken: string;
  readonly clientId: string;
}

export async function exchangeCode(
  provider: string,
  code: string,
  flow: Flow,
  redirectUri: string | null,
): Promise<{ readonly subject: string; readonly grant: Grant } | null> {
  const config = grantConfig(provider);
  if (!config) return null;
  const clientId = config.clientId(flow);
  const response = await fetch(config.tokenUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: clientId,
      client_secret: await config.clientSecret(clientId),
      ...(redirectUri ? { redirect_uri: redirectUri } : {}),
    }),
  });
  const answer = (await response.json().catch(() => null)) as { refresh_token?: unknown; id_token?: unknown } | null;
  if (!response.ok || typeof answer?.refresh_token !== 'string' || typeof answer.id_token !== 'string') return null;
  const claims = await verifyIdToken(provider, answer.id_token);
  return claims ? { subject: claims.sub, grant: { refreshToken: answer.refresh_token, clientId } } : null;
}

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
  return response.ok || (provider === 'google' && response.status === 400);
}

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

export async function seal(grant: Grant): Promise<string | null> {
  const raw = sealingKey();
  if (!raw) return null;
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plain = new TextEncoder().encode(JSON.stringify(grant));
  const sealed = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await aesKey(raw, 'encrypt'), plain));
  return `v1.${toBase64(iv)}.${toBase64(sealed)}`;
}

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

const base64url = (bytes: Uint8Array) => toBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

async function appleClientSecret(teamId: string, keyId: string, pem: string, clientId: string): Promise<string> {
  const body = pem.replace(/-----(BEGIN|END) PRIVATE KEY-----/g, '').replace(/\s+/g, '');
  const key = await crypto.subtle.importKey('pkcs8', fromBase64(body), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const now = Math.floor(Date.now() / 1000);
  const encode = (value: unknown) => base64url(new TextEncoder().encode(JSON.stringify(value)));
  const unsigned = `${encode({ alg: 'ES256', kid: keyId })}.${encode({ iss: teamId, iat: now, exp: now + 300, aud: 'https://appleid.apple.com', sub: clientId })}`;
  const signature = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(unsigned)));
  return `${unsigned}.${base64url(signature)}`;
}
