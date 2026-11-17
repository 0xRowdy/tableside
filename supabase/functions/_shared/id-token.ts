// docs/environments.md
// docs/account-service.md Apple and Google

declare const Deno: { env: { get(name: string): string | undefined } };

export interface IdTokenClaims {
  readonly iss: string;
  readonly sub: string;
  readonly aud: string | readonly string[];
  readonly exp: number;
  readonly nonce?: string;
}

interface ProviderConfig {
  readonly issuer: string;
  readonly audiences: readonly string[];
}

const LEEWAY_SECONDS = 30;

export function providerConfig(provider: string): ProviderConfig | null {
  if (!/^[a-z]+$/.test(provider)) return null;
  const prefix = `TABLESIDE_ID_TOKEN_${provider.toUpperCase()}`;
  const issuer = Deno.env.get(`${prefix}_ISSUER`);
  const audiences = (Deno.env.get(`${prefix}_AUDIENCES`) ?? '')
    .split(',')
    .map((audience) => audience.trim())
    .filter(Boolean);
  return issuer && audiences.length > 0 ? { issuer, audiences } : null;
}

export async function verifyIdToken(provider: string, token: string, hashedNonce?: string): Promise<IdTokenClaims | null> {
  const claims = (await verifyProviderJwt(provider, token)) as Partial<IdTokenClaims> | null;
  if (!claims) return null;
  if (typeof claims.sub !== 'string' || !claims.sub) return null;
  if (typeof claims.exp !== 'number' || claims.exp + LEEWAY_SECONDS < Date.now() / 1000) return null;
  if (hashedNonce !== undefined && claims.nonce !== hashedNonce) return null;
  return claims as IdTokenClaims;
}

export async function verifyProviderJwt(provider: string, token: string): Promise<Record<string, unknown> | null> {
  const config = providerConfig(provider);
  if (!config) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [headerPart, claimsPart, signaturePart] = parts as [string, string, string];
  const header = decodeJson(headerPart) as { alg?: unknown; kid?: unknown } | null;
  const claims = decodeJson(claimsPart) as Record<string, unknown> | null;
  if (!header || header.alg !== 'RS256' || typeof header.kid !== 'string' || !claims || typeof claims !== 'object') return null;

  const key = await signingKey(config.issuer, header.kid);
  const signature = decodeBase64Url(signaturePart);
  if (!key || !signature) return null;
  const signed = new TextEncoder().encode(`${headerPart}.${claimsPart}`);
  if (!(await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, signature, signed))) return null;

  const issuers = config.issuer === 'https://accounts.google.com' ? [config.issuer, 'accounts.google.com', 'https://accounts.google.com/'] : [config.issuer];
  const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (typeof claims.iss !== 'string' || !issuers.includes(claims.iss)) return null;
  if (!audiences.some((audience) => typeof audience === 'string' && config.audiences.includes(audience))) return null;
  return claims;
}

export async function sha256Hex(text: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)));
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

const keySets = new Map<string, Map<string, CryptoKey>>();

async function signingKey(issuer: string, keyId: string): Promise<CryptoKey | null> {
  const known = keySets.get(issuer)?.get(keyId);
  if (known) return known;
  try {
    const discovery = (await (await fetch(`${issuer}/.well-known/openid-configuration`)).json()) as { jwks_uri?: unknown };
    if (typeof discovery.jwks_uri !== 'string') return null;
    const { keys } = (await (await fetch(discovery.jwks_uri)).json()) as { keys?: unknown };
    const imported = new Map<string, CryptoKey>();
    for (const jwk of Array.isArray(keys) ? (keys as (JsonWebKey & { kid?: string; use?: string })[]) : []) {
      if (jwk.kty !== 'RSA' || typeof jwk.kid !== 'string' || (jwk.use && jwk.use !== 'sig')) continue;
      const material: JsonWebKey = { kty: 'RSA', n: jwk.n, e: jwk.e, alg: 'RS256' };
      imported.set(jwk.kid, await crypto.subtle.importKey('jwk', material, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']));
    }
    keySets.set(issuer, imported);
    return imported.get(keyId) ?? null;
  } catch {
    return null;
  }
}

function decodeBase64Url(text: string): Uint8Array<ArrayBuffer> | null {
  try {
    const padded = text.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(text.length / 4) * 4, '=');
    return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
  } catch {
    return null;
  }
}

function decodeJson(part: string): unknown {
  const bytes = decodeBase64Url(part);
  if (!bytes) return null;
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return null;
  }
}
