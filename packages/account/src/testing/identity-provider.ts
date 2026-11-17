import { createHash, createSign, generateKeyPairSync, randomBytes, randomUUID } from 'node:crypto';
import { type Server, createServer } from 'node:http';

import type { AuthSessionResult, IdentityProvider, ProviderPorts, ProviderSettings, ProviderToken } from '../service';
import { slotPort } from './stack';

const PORT = slotPort(54330);
const ISSUER = `http://host.docker.internal:${PORT}`;
const CLIENT_ID = 'tableside-test-idp';
const CLIENT_SECRET = 'unused-test-idp-secret';

const base64url = (value: string | Buffer) => Buffer.from(value).toString('base64url');

export interface ProviderIdentity {
  readonly subject: string;
  readonly email: string;
  readonly emailVerified?: boolean;
}

export class TestIdentityProvider {
  readonly provider = 'keycloak';
  readonly authorizeUrl = `${ISSUER}/authorize`;
  readonly clientId = CLIENT_ID;
  private readonly keys = generateKeyPairSync('rsa', { modulusLength: 2048 });
  private readonly keyId = randomUUID();
  private server: Server | null = null;
  private readonly codes = new Map<string, { readonly identity: ProviderIdentity; readonly redirectUri: string | null }>();
  private readonly grants = new Map<string, { readonly subject: string; revoked: boolean }>();

  authorizationCode(identity: ProviderIdentity, redirectUri: string | null = null): string {
    const code = `code-${randomBytes(12).toString('hex')}`;
    this.codes.set(code, { identity, redirectUri });
    return code;
  }

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
    await new Promise<void>((resolve) => this.server!.listen(PORT, '0.0.0.0', resolve));
  }

  private oauth(path: string, form: URLSearchParams): { readonly status: number; readonly body: unknown } {
    if (form.get('client_id') !== CLIENT_ID || form.get('client_secret') !== CLIENT_SECRET) return { status: 401, body: { error: 'invalid_client' } };
    if (path === '/revoke') {
      const grant = this.grants.get(form.get('token') ?? '');
      if (grant) grant.revoked = true;
      return { status: 200, body: {} };
    }
    const issued = form.get('grant_type') === 'authorization_code' ? this.codes.get(form.get('code') ?? '') : undefined;
    if (!issued || (issued.redirectUri !== null && form.get('redirect_uri') !== issued.redirectUri)) return { status: 400, body: { error: 'invalid_grant' } };
    const { identity } = issued;
    this.codes.delete(form.get('code')!);
    const refreshToken = `refresh-${randomBytes(16).toString('hex')}`;
    this.grants.set(refreshToken, { subject: identity.subject, revoked: false });
    return { status: 200, body: { access_token: `access-${randomBytes(8).toString('hex')}`, token_type: 'Bearer', refresh_token: refreshToken, id_token: this.idToken(identity) } };
  }

  async stop(): Promise<void> {
    await new Promise<void>((resolve) => (this.server ? this.server.close(() => resolve()) : resolve()));
    this.server = null;
  }

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

  appleNotification(event: { readonly type: string; readonly sub: string; readonly email?: string }, options: Parameters<TestIdentityProvider['securityEvent']>[1] = {}): string {
    return JSON.stringify({ payload: this.securityEvent(JSON.stringify({ ...event, event_time: Date.now() }), options) });
  }

  googleSecurityEvent(type: string, subject: string, options: Parameters<TestIdentityProvider['securityEvent']>[1] = {}): string {
    return this.securityEvent({ [`https://schemas.openid.net/secevent/risc/event-type/${type}`]: { subject: { subject_type: 'iss-sub', iss: ISSUER, sub: subject } } }, options);
  }

  devicePorts(routes: ProviderPorts['route']): TestProviderPorts {
    return new TestProviderPorts(this, routes);
  }

  async playWebAuthorize(
    url: string,
    identity: ProviderIdentity | null,
    tamper: ((form: URLSearchParams) => URLSearchParams) | null = null,
  ): Promise<string | null> {
    const authorize = new URL(url);
    const param = (name: string) => authorize.searchParams.get(name) ?? '';
    if (`${authorize.origin}${authorize.pathname}` !== this.authorizeUrl) throw new Error(`the browser opened an unexpected page: ${authorize.origin}`);
    let form = new URLSearchParams({ state: param('state') });
    if (identity) {
      form.set('id_token', this.idToken(identity, { nonce: param('nonce'), audience: param('client_id') }));
      form.set('code', this.authorizationCode(identity, param('redirect_uri')));
    } else form.set('error', 'user_cancelled_authorize');
    if (tamper) form = tamper(form);
    const response = await fetch(param('redirect_uri'), {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: form,
      redirect: 'manual',
    });
    await response.body?.cancel();
    return response.status >= 300 && response.status < 400 ? response.headers.get('location') : null;
  }

  settings(ports: TestProviderPorts): ProviderSettings {
    return { ports, authName: { apple: this.provider, google: this.provider }, appleWeb: { authorizeUrl: this.authorizeUrl, clientId: CLIENT_ID } };
  }
}

export class TestProviderPorts implements ProviderPorts {
  readonly accounts: Record<IdentityProvider, ProviderIdentity | null> = { apple: null, google: null };
  readonly opened: { readonly provider: IdentityProvider | 'browser'; readonly url?: string }[] = [];
  readonly returned: string[] = [];
  tamper: ((form: URLSearchParams) => URLSearchParams) | null = null;
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
    const code = this.withoutCode.has(provider) ? {} : { authorizationCode: this.idp.authorizationCode(identity) };
    return { status: 'token', idToken: this.idp.idToken(identity, { nonce: request.hashedNonce }), ...code };
  }

  async openAuthSession(url: string, callbackUrl: string): Promise<AuthSessionResult> {
    this.opened.push({ provider: 'browser', url });
    const location = await this.idp.playWebAuthorize(url, this.accounts.apple, this.tamper);
    if (!location?.startsWith(callbackUrl)) return { status: 'canceled' };
    this.returned.push(location);
    return { status: 'returned', url: location };
  }
}
