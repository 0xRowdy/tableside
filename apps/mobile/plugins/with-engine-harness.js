// Harness builds only (ENGINE_HARNESS=1 at prebuild): let the release app post
// its report to the development machine over cleartext HTTP on localhost,
// which `adb reverse` forwards. Ordinary builds are unchanged.
const { withAndroidManifest } = require('expo/config-plugins');

module.exports = function withEngineHarness(config) {
  if (process.env.ENGINE_HARNESS !== '1') return config;
  return withAndroidManifest(config, (mod) => {
    mod.modResults.manifest.application[0].$['android:usesCleartextTraffic'] = 'true';
    return mod;
  });
};
