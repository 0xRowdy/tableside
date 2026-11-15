// The test identity provider: a minimal OpenID Connect issuer standing in for
// Apple and Google in seam 2 scenarios. Auth knows it as its Keycloak provider
// (supabase/config.toml), fetches its discovery document and keys from this
// process, and accepts the ID tokens it signs. The edge functions that verify
// ID tokens themselves (bind-provider-assertion, provider-callback) know it the
// same way, from [edge_runtime.secrets].

import { createHash, createSign, generateKeyPairSync, randomUUID } from 'node:crypto';
import { type Server, createServer } from 'node:http';

import type { AuthSessionResult, IdentityProvider, ProviderPorts, ProviderSettings, ProviderToken } from '../service';
import { slotPort } from './stack';

/** Must match [auth.external.keycloak] in supabase/config.toml. */
const PORT = slotPort(54330);
const ISSUER = `http://host.docker.internal:${PORT}`;
const CLIENT_ID = 'tableside-test-idp';

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
      const document = documents[request.url ?? ''];
      response.writeHead(document ? 200 : 404, { 'content-type': 'application/json' });
      response.end(JSON.stringify(document ?? {}));
    });
    // Auth reaches this process from its container through the host gateway.
    await new Promise<void>((resolve) => this.server!.listen(PORT, '0.0.0.0', resolve));
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
    if (!identity) return { status: 'cancelled' };
    return { status: 'token', idToken: this.idp.idToken(identity, { nonce: request.hashedNonce }) };
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
    if (identity) form.set('id_token', this.idp.idToken(identity, { nonce: param('nonce'), audience: param('client_id') }));
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
    if (response.status < 300 || response.status >= 400 || !location?.startsWith(callbackUrl)) return { status: 'cancelled' };
    this.returned.push(location);
    return { status: 'returned', url: location };
  }
}
