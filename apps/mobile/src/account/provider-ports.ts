// Spec 2 #89

import type { ProviderPorts, ProviderSettings } from '@tableside/account';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import { googleIdToken } from '../../modules/google-sign-in';

const APPLE_AUTHORIZE_URL = 'https://appleid.apple.com/auth/authorize';

export function providerSettings(): ProviderSettings {
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
        const credential = await AppleAuthentication.signInAsync({
          requestedScopes: [AppleAuthentication.AppleAuthenticationScope.EMAIL],
          nonce: hashedNonce,
        });
        if (!credential.identityToken) return { status: 'failed' };
        return { status: 'token', idToken: credential.identityToken, ...(credential.authorizationCode ? { authorizationCode: credential.authorizationCode } : {}) };
      } catch (error) {
        return { status: (error as { code?: unknown }).code === 'ERR_REQUEST_CANCELED' ? 'canceled' : 'failed' };
      }
    },

    async openAuthSession(url, callbackUrl) {
      const result = await WebBrowser.openAuthSessionAsync(url, callbackUrl);
      return result.type === 'success' ? { status: 'returned', url: result.url } : { status: 'canceled' };
    },

    sha256Hex: (text) => Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, text, { encoding: Crypto.CryptoEncoding.HEX }),
  };

  return { ports, appleWeb: { authorizeUrl: APPLE_AUTHORIZE_URL, clientId: appleServicesId } };
}
