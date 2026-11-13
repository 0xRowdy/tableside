// The test identity provider: a minimal OpenID Connect issuer standing in for
// Apple and Google in seam 2 scenarios. Auth knows it as its Keycloak provider
// (supabase/config.toml), fetches its discovery document and keys from this
// process, and accepts the ID tokens it signs.

import { createSign, generateKeyPairSync, randomUUID } from 'node:crypto';
import { type Server, createServer } from 'node:http';

/** Must match [auth.external.keycloak] in supabase/config.toml. */
const PORT = 54330;
const ISSUER = `http://host.docker.internal:${PORT}`;
const CLIENT_ID = 'tableside-test-idp';

const base64url = (value: string | Buffer) => Buffer.from(value).toString('base64url');

export class TestIdentityProvider {
  /** The provider name a client passes to Auth. */
  readonly provider = 'keycloak';
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

  /** A signed ID token for an identity at this provider. */
  idToken(identity: { readonly subject: string; readonly email: string; readonly emailVerified?: boolean }): string {
    const now = Math.floor(Date.now() / 1000);
    const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT', kid: this.keyId }));
    const claims = base64url(
      JSON.stringify({
        iss: ISSUER,
        aud: CLIENT_ID,
        sub: identity.subject,
        email: identity.email,
        email_verified: identity.emailVerified ?? true,
        iat: now,
        exp: now + 600,
      }),
    );
    const signature = createSign('RSA-SHA256').update(`${header}.${claims}`).sign(this.keys.privateKey);
    return `${header}.${claims}.${base64url(signature)}`;
  }
}
