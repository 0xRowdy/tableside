import type { ExpoConfig } from 'expo/config';

const BACKGROUND = '#0E1311';

// docs/cross-runtime-harness.md How it works
const ENGINE_HARNESS = process.env.ENGINE_HARNESS === '1';

const config: ExpoConfig = {
  name: 'Tableside',
  slug: 'tableside',
  version: '0.1.0',
  scheme: 'tableside',
  orientation: 'default',
  userInterfaceStyle: 'dark',
  backgroundColor: BACKGROUND,
  icon: './assets/images/icon.png',
  ios: {
    bundleIdentifier: 'com.tableside.app',
    icon: './assets/expo.icon',
    supportsTablet: true,
    requireFullScreen: false,
    // Spec 2 #89
    usesAppleSignIn: !ENGINE_HARNESS,
  },
  android: {
    package: 'com.tableside.app',
    adaptiveIcon: {
      backgroundColor: BACKGROUND,
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundImage: './assets/images/android-icon-background.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
  },
  plugins: [
    'expo-router',
    'expo-image',
    ['expo-splash-screen', { backgroundColor: BACKGROUND, image: './assets/images/splash-icon.png', imageWidth: 76 }],
    [
      'expo-build-properties',
      {
        // docs/development.md Toolchain
        ios: { deploymentTarget: '16.4' },
        android: { minSdkVersion: 29 },
      },
    ],
    ['expo-audio', { microphonePermission: false, recordAudioAndroid: false, enableBackgroundPlayback: false, enableBackgroundRecording: false }],
    ['expo-sqlite', { useSQLCipher: true }],
    // Spec 2 Backup exclusion
    ['expo-secure-store', { configureAndroidBackup: false }],
    'expo-localization',
    ...(ENGINE_HARNESS ? [] : ['expo-apple-authentication']),
    'expo-web-browser',
    './plugins/with-google-sign-in',
    './plugins/with-backup-exclusion',
    './plugins/with-engine-harness',
    './plugins/with-responsiveness-sampling',
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
};

export default config;
