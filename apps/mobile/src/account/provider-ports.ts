// Apple and Google sign-in on this device (spec 2 #89), behind the Account
// service's provider ports. Apple is native on iOS (expo-apple-authentication)
// and goes through the secure system browser on Android (expo-web-browser:
// Custom Tabs, returning to tableside://auth/<environment>). Google is native
// on both (modules/google-sign-in). Every route asks for an ID token carrying
// the hashed nonce; the Account service gives Auth the nonce itself.
//
// The client IDs are build-time settings (docs/environments.md). A build
// without one has no sign-in with that provider on that platform. None of them
// is a secret: provider secrets stay on the server.

import type { ProviderPorts, ProviderSettings } from '@tableside/account';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import { googleIdToken } from '../../modules/google-sign-in';

const APPLE_AUTHORIZE_URL = 'https://appleid.apple.com/auth/authorize';

export function providerSettings(): ProviderSettings {
  // Each read must be spelled out in full for Expo to inline it.
  const googleWebClientId = process.env.EXPO_PUBLIC_TABLESIDE_GOOGLE_WEB_CLIENT_ID ?? '';
  const googleIosClientId = process.env.EXPO_PUBLIC_TABLESIDE_GOOGLE_IOS_CLIENT_ID ?? '';
  const appleServicesId = process.env.EXPO_PUBLIC_TABLESIDE_APPLE_SERVICES_ID ?? '';
  const ios = Platform.OS === 'ios';

  const ports: ProviderPorts = {
    route: {
      apple: ios ? 'native' : appleServicesId ? 'browser' : 'unavailable',
      google: googleWebClientId && (!ios || googleIosClientId) ? 'native' : 'unavailable',
    },

    async nativeIdToken(provider, { hashedNonce }) {
      if (provider === 'google') return googleIdToken(googleIosClientId, googleWebClientId, hashedNonce);
      try {
        // Apple writes the nonce it is given into the token's nonce claim.
        const credential = await AppleAuthentication.signInAsync({
          requestedScopes: [AppleAuthentication.AppleAuthenticationScope.EMAIL],
          nonce: hashedNonce,
        });
        return credential.identityToken ? { status: 'token', idToken: credential.identityToken } : { status: 'failed' };
      } catch (error) {
        return { status: (error as { code?: unknown }).code === 'ERR_REQUEST_CANCELED' ? 'cancelled' : 'failed' };
      }
    },

    async openAuthSession(url, callbackUrl) {
      const result = await WebBrowser.openAuthSessionAsync(url, callbackUrl);
      return result.type === 'success' ? { status: 'returned', url: result.url } : { status: 'cancelled' };
    },

    sha256Hex: (text) => Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, text, { encoding: Crypto.CryptoEncoding.HEX }),
  };

  return { ports, appleWeb: { authorizeUrl: APPLE_AUTHORIZE_URL, clientId: appleServicesId } };
}
