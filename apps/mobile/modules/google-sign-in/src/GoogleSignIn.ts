// Spec 2 #89
import { requireNativeModule } from 'expo';

export type GoogleIdTokenResult = { readonly status: 'token'; readonly idToken: string } | { readonly status: 'canceled' } | { readonly status: 'failed' };

const native = requireNativeModule<{
  signIn(clientId: string, serverClientId: string, nonce: string): Promise<{ status: string; idToken?: string }>;
}>('TablesideGoogleSignIn');

export async function googleIdToken(clientId: string, serverClientId: string, nonce: string): Promise<GoogleIdTokenResult> {
  try {
    const answer = await native.signIn(clientId, serverClientId, nonce);
    if (answer.status === 'token' && typeof answer.idToken === 'string') return { status: 'token', idToken: answer.idToken };
    return { status: answer.status === 'canceled' ? 'canceled' : 'failed' };
  } catch {
    return { status: 'failed' };
  }
}
