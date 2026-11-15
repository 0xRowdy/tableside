// Native Sign in with Google that ends in an ID token carrying the app's nonce
// (spec 2 #89: nonce validated). The free Google Sign-In package for React
// Native takes no nonce, so this local module calls the platform APIs that do:
// Credential Manager's Sign in with Google on Android, and GoogleSignIn 8 on iOS.
import { requireNativeModule } from 'expo';

export type GoogleIdTokenResult = { readonly status: 'token'; readonly idToken: string } | { readonly status: 'cancelled' } | { readonly status: 'failed' };

const native = requireNativeModule<{
  signIn(clientId: string, serverClientId: string, nonce: string): Promise<{ status: string; idToken?: string }>;
}>('TablesideGoogleSignIn');

/**
 * Shows Google's sign-in and resolves with an ID token whose nonce claim is
 * `nonce`. `clientId` is the platform's OAuth client (iOS; unused on Android),
 * `serverClientId` the web client Auth verifies tokens for.
 */
export async function googleIdToken(clientId: string, serverClientId: string, nonce: string): Promise<GoogleIdTokenResult> {
  try {
    const answer = await native.signIn(clientId, serverClientId, nonce);
    if (answer.status === 'token' && typeof answer.idToken === 'string') return { status: 'token', idToken: answer.idToken };
    return { status: answer.status === 'cancelled' ? 'cancelled' : 'failed' };
  } catch {
    return { status: 'failed' };
  }
}
