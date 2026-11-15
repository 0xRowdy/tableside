// The test identity provider: a minimal OpenID Connect issuer standing in for
// Apple and Google in seam 2 scenarios. Auth knows it as its Keycloak provider
// (supabase/config.toml), fetches its discovery document and keys from this
// process, and accepts the ID tokens it signs. The edge functions that verify
// ID tokens themselves (bind-provider-assertion, provider-callback) know it the
// same way, from [edge_runtime.secrets].

import { createHash, createSign, generateKeyPairSync, randomBytes, randomUUID } from 'node:crypto';
import { type Server, createServer } from 'node:http';

import type { AuthSessionResult, IdentityProvider, ProviderPorts, ProviderSettings, ProviderToken } from '../service';
import { slotPort } from './stack';

/** Must match [auth.external.keycloak] in supabase/config.toml. */
const PORT = slotPort(54330);
const ISSUER = `http://host.docker.internal:${PORT}`;
const CLIENT_ID = 'tableside-test-idp';
/** Must match TABLESIDE_GRANT_KEYCLOAK_CLIENT_SECRET in supabase/config.toml. */
const CLIENT_SECRET = 'unused-test-idp-secret';

const base64url = (value: string | Buffer) => Buffer.from(value).toString('base64url');

/** Someone signed in at the provider on a device. */
export interface ProviderIdentity {
  readonly subject: string;
  readonly email: string;
  readonly emailVerified?: boolean;
}

export class TestIdentityProvider {
  /** The provider name a client passes to Auth. */
  readonly provider = 'keycloak';
  /** The provider's web authorization endpoint, as Apple's on Android. Nothing answers it: the test browser plays the provider's page. */
  readonly authorizeUrl = `${ISSUER}/authorize`;
  readonly clientId = CLIENT_ID;
  private readonly keys = generateKeyPairSync('rsa', { modulusLength: 2048 });
  private readonly keyId = randomUUID();
  private server: Server | null = null;
  /** Authorization codes not yet exchanged, by code: who each is for. */
  private readonly codes = new Map<string, ProviderIdentity>();
  /** Refresh tokens issued for a code, by token: whose, and whether the app revoked it. */
  private readonly grants = new Map<string, { readonly subject: string; revoked: boolean }>();

  /** An authorization code for `identity`, as the provider hands the app one with its ID token. */
  authorizationCode(identity: ProviderIdentity): string {
    const code = `code-${randomBytes(12).toString('hex')}`;
    this.codes.set(code, identity);
    return code;
  }

  /** The refresh tokens issued for a subject, and whether each was revoked: what the provider holds for the app. */
  grantsFor(subject: string): { readonly revoked: boolean }[] {
    return [...this.grants.values()].filter((grant) => grant.subject === subject).map(({ revoked }) => ({ revoked }));
  }

  async start(): Promise<void> {
    const jwk = { ...this.keys.publicKey.export({ format: 'jwk' }), kid: this.keyId, alg: 'RS256', use: 'sig' };
    const documents: Record<string, unknown> = {
      '/.well-known/openid-configuration': {
        issuer: ISSUER,
        jwks_uri: `${ISSUER}/jwks`,
        authorization_endpoint: `${ISSUER}/authorize`,
        token_endpoint: `${ISSUER}/token`,
        response_types_supported: ['id_token'],
        subject_types_supported: ['public'],
        id_token_signing_alg_values_supported: ['RS256'],
      },
      '/jwks': { keys: [jwk] },
    };
    this.server = createServer((request, response) => {
      if (request.method === 'POST' && (request.url === '/token' || request.url === '/revoke')) {
        let text = '';
        request.on('data', (chunk: Buffer) => (text += chunk.toString('utf8')));
        request.on('end', () => {
          const form = new URLSearchParams(text);
          const answer = this.oauth(request.url!, form);
          response.writeHead(answer.status, { 'content-type': 'application/json' });
          response.end(JSON.stringify(answer.body));
        });
        return;
      }
      const document = documents[request.url ?? ''];
      response.writeHead(document ? 200 : 404, { 'content-type': 'application/json' });
      response.end(JSON.stringify(document ?? {}));
    });
    // Auth reaches this process from its container through the host gateway.
    await new Promise<void>((resolve) => this.server!.listen(PORT, '0.0.0.0', resolve));
  }

  /** The token endpoint (an authorization code for a refresh token and ID token) and the revocation endpoint, as Apple's and Google's. */
  private oauth(path: string, form: URLSearchParams): { readonly status: number; readonly body: unknown } {
    if (form.get('client_id') !== CLIENT_ID || form.get('client_secret') !== CLIENT_SECRET) return { status: 401, body: { error: 'invalid_client' } };
    if (path === '/revoke') {
      const grant = this.grants.get(form.get('token') ?? '');
      if (grant) grant.revoked = true;
      return { status: 200, body: {} };
    }
    const identity = form.get('grant_type') === 'authorization_code' ? this.codes.get(form.get('code') ?? '') : undefined;
    if (!identity) return { status: 400, body: { error: 'invalid_grant' } };
    this.codes.delete(form.get('code')!);
    const refreshToken = `refresh-${randomBytes(16).toString('hex')}`;
    this.grants.set(refreshToken, { subject: identity.subject, revoked: false });
    return { status: 200, body: { access_token: `access-${randomBytes(8).toString('hex')}`, token_type: 'Bearer', refresh_token: refreshToken, id_token: this.idToken(identity) } };
  }

  async stop(): Promise<void> {
    await new Promise<void>((resolve) => (this.server ? this.server.close(() => resolve()) : resolve()));
    this.server = null;
  }

  /**
   * A signed ID token for an identity at this provider. `nonce` is the claim
   * as the provider writes it (the SHA-256 of the client's nonce); a token may
   * also be issued for another audience or issuer, or already expired.
   */
  idToken(
    identity: ProviderIdentity,
    options: { readonly nonce?: string; readonly audience?: string; readonly issuer?: string; readonly expiresIn?: number } = {},
  ): string {
    const now = Math.floor(Date.now() / 1000);
    const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT', kid: this.keyId }));
    const claims = base64url(
      JSON.stringify({
        iss: options.issuer ?? ISSUER,
        aud: options.audience ?? CLIENT_ID,
        sub: identity.subject,
        email: identity.email,
        email_verified: identity.emailVerified ?? true,
        iat: now,
        exp: now + (options.expiresIn ?? 600),
        ...(options.nonce !== undefined ? { nonce: options.nonce } : {}),
      }),
    );
    const signature = createSign('RSA-SHA256').update(`${header}.${claims}`).sign(this.keys.privateKey);
    return `${header}.${claims}.${base64url(signature)}`;
  }

  /**
   * A security event this provider signed, as its server-to-server
   * notifications carry them: `events` is Apple's JSON string or Google's
   * object keyed by event type. It may be issued long ago, for another
   * audience, or signed by a key that isn't the provider's (a forgery).
   */
  securityEvent(
    events: unknown,
    options: { readonly issuedAt?: number; readonly audience?: string; readonly id?: string; readonly forged?: boolean } = {},
  ): string {
    const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT', kid: this.keyId }));
    const claims = base64url(
      JSON.stringify({
        iss: ISSUER,
        aud: options.audience ?? CLIENT_ID,
        iat: options.issuedAt ?? Math.floor(Date.now() / 1000),
        jti: options.id ?? randomUUID(),
        events,
      }),
    );
    const key = options.forged ? generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey : this.keys.privateKey;
    const signature = createSign('RSA-SHA256').update(`${header}.${claims}`).sign(key);
    return `${header}.${claims}.${base64url(signature)}`;
  }

  /** Apple's server-to-server notification body: `{ payload }`, its event a JSON string. */
  appleNotification(event: { readonly type: string; readonly sub: string; readonly email?: string }, options: Parameters<TestIdentityProvider['securityEvent']>[1] = {}): string {
    return JSON.stringify({ payload: this.securityEvent(JSON.stringify({ ...event, event_time: Date.now() }), options) });
  }

  /** Google's security event (Cross-Account Protection): the JWT itself, its events keyed by type URI. */
  googleSecurityEvent(type: string, subject: string, options: Parameters<TestIdentityProvider['securityEvent']>[1] = {}): string {
    return this.securityEvent({ [`https://schemas.openid.net/secevent/risc/event-type/${type}`]: { subject: { subject_type: 'iss-sub', iss: ISSUER, sub: subject } } }, options);
  }

  /**
   * A device's Apple and Google sign-in, with this provider standing in for
   * both: native sheets that return ID tokens, and a system browser for
   * Apple's web flow. The scenario sets who is signed in at each provider, or
   * that the player cancels.
   */
  devicePorts(routes: ProviderPorts['route']): TestProviderPorts {
    return new TestProviderPorts(this, routes);
  }

  /** The Account service's provider settings for a device using these ports. */
  settings(ports: TestProviderPorts): ProviderSettings {
    return { ports, authName: { apple: this.provider, google: this.provider }, appleWeb: { authorizeUrl: this.authorizeUrl, clientId: CLIENT_ID } };
  }
}

/** What the provider's sheet or page did, as the scenario scripts it. */
export class TestProviderPorts implements ProviderPorts {
  /** Who is signed in at each provider on this device; null cancels. */
  readonly accounts: Record<IdentityProvider, ProviderIdentity | null> = { apple: null, google: null };
  /** Every native sheet and browser session opened, in order. */
  readonly opened: { readonly provider: IdentityProvider | 'browser'; readonly url?: string }[] = [];
  /** The callback URLs the browser returned to the app. */
  readonly returned: string[] = [];
  /** Rewrites the form the provider's page posts back (a tampered or replayed callback). */
  tamper: ((form: URLSearchParams) => URLSearchParams) | null = null;
  /** Providers whose native sheet answers with an ID token alone, no authorization code. */
  readonly withoutCode = new Set<IdentityProvider>();

  constructor(
    private readonly idp: TestIdentityProvider,
    readonly route: ProviderPorts['route'],
  ) {}

  async sha256Hex(text: string): Promise<string> {
    return createHash('sha256').update(text).digest('hex');
  }

  async nativeIdToken(provider: IdentityProvider, request: { readonly hashedNonce: string }): Promise<ProviderToken> {
    this.opened.push({ provider });
    const identity = this.accounts[provider];
    if (!identity) return { status: 'canceled' };
    // A provider that gives the app no authorization code (Google's native ID-token sign-in on Android) gives only the token.
    const code = this.withoutCode.has(provider) ? {} : { authorizationCode: this.idp.authorizationCode(identity) };
    return { status: 'token', idToken: this.idp.idToken(identity, { nonce: request.hashedNonce }), ...code };
  }

  /**
   * The system browser on Apple's page: the player signs in as `accounts.apple`
   * and the page posts the result to the redirect URI (Apple's form_post),
   * whose answer redirects back to the app.
   */
  async openAuthSession(url: string, callbackUrl: string): Promise<AuthSessionResult> {
    this.opened.push({ provider: 'browser', url });
    const authorize = new URL(url);
    const param = (name: string) => authorize.searchParams.get(name) ?? '';
    if (`${authorize.origin}${authorize.pathname}` !== this.idp.authorizeUrl) throw new Error(`the browser opened an unexpected page: ${authorize.origin}`);
    const identity = this.accounts.apple;
    let form = new URLSearchParams({ state: param('state') });
    if (identity) {
      form.set('id_token', this.idp.idToken(identity, { nonce: param('nonce'), audience: param('client_id') }));
      form.set('code', this.idp.authorizationCode(identity));
    }
    else form.set('error', 'user_cancelled_authorize');
    if (this.tamper) form = this.tamper(form);
    const response = await fetch(param('redirect_uri'), {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: form,
      redirect: 'manual',
    });
    await response.body?.cancel();
    const location = response.headers.get('location');
    // The browser hands back only a redirect to the app's own callback URL.
    if (response.status < 300 || response.status >= 400 || !location?.startsWith(callbackUrl)) return { status: 'canceled' };
    this.returned.push(location);
    return { status: 'returned', url: location };
  }
}
