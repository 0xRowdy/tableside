// A harness build (EXPO_PUBLIC_ENGINE_HARNESS=1) boots straight into the
// cross-runtime engine suite instead of the app. Expo inlines the variable at
// bundle time, so ordinary builds never load the harness.
if (process.env.EXPO_PUBLIC_ENGINE_HARNESS === '1') {
  require('./src/harness/entry');
} else {
  require('expo-router/entry');
}
