// docs/cross-runtime-harness.md How it works
if (process.env.EXPO_PUBLIC_ENGINE_HARNESS === '1') {
  require('./src/harness/entry');
} else {
  require('expo-router/entry');
}
