// Harness builds only (ENGINE_HARNESS=1 at prebuild). Ordinary builds are unchanged.
// - Android: let the release app post its report to the development machine
//   over cleartext HTTP on localhost, which `adb reverse` forwards.
// - iOS: drop the Sign in with Apple entitlement an earlier ordinary prebuild
//   left in the project, since Expo won't build a simulator app carrying it
//   without a signing certificate (app.config.ts leaves it out for the harness).
const { withAndroidManifest, withEntitlementsPlist } = require('expo/config-plugins');

module.exports = function withEngineHarness(config) {
  if (process.env.ENGINE_HARNESS !== '1') return config;
  config = withAndroidManifest(config, (mod) => {
    mod.modResults.manifest.application[0].$['android:usesCleartextTraffic'] = 'true';
    return mod;
  });
  return withEntitlementsPlist(config, (mod) => {
    delete mod.modResults['com.apple.developer.applesignin'];
    return mod;
  });
};
