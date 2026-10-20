import type { ExpoConfig } from 'expo/config';

// Expo loads this file without transpiling its TypeScript imports, so the
// background token (BACKGROUND in src/theme/tokens.ts) is repeated here.
const BACKGROUND = '#0E1311';

const config: ExpoConfig = {
  name: 'Tableside',
  slug: 'tableside',
  version: '0.1.0',
  scheme: 'tableside',
  // Portrait and landscape everywhere, on phones and tablets.
  orientation: 'default',
  // Dark theme only at launch; colors are tokens so a light theme can follow.
  userInterfaceStyle: 'dark',
  backgroundColor: BACKGROUND,
  icon: './assets/images/icon.png',
  ios: {
    bundleIdentifier: 'com.tableside.app',
    icon: './assets/expo.icon',
    supportsTablet: true,
    // Allow iPad multitasking: resizable windows rather than full screen only.
    requireFullScreen: false,
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
        // Product floors: iOS/iPadOS 16.4+, Android 10 (API 29)+.
        ios: { deploymentTarget: '16.4' },
        android: { minSdkVersion: 29 },
      },
    ],
    // Cues only: nothing plays in the background and nothing records.
    ['expo-audio', { microphonePermission: false, recordAudioAndroid: false, enableBackgroundPlayback: false, enableBackgroundRecording: false }],
    './plugins/with-engine-harness',
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
};

export default config;
