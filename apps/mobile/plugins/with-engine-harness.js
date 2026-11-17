// docs/cross-runtime-harness.md How it works
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
