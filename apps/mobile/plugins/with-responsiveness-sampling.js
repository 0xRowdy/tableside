// docs/development.md Responsiveness sampling
const { withAndroidManifest, withPodfile, withSettingsGradle } = require('expo/config-plugins');

const SAMPLING_MODULE = 'responsiveness-sampling';
const PODFILE_ANCHOR = 'use_expo_modules!';
const SETTINGS_ANCHOR = 'expoAutolinking.useExpoModules()';

function replaceOnce(contents, anchor, replacement, file) {
  const at = contents.indexOf(anchor);
  if (at === -1 || contents.indexOf(anchor, at + anchor.length) !== -1) {
    throw new Error(`with-responsiveness-sampling: expected exactly one "${anchor}" in ${file}`);
  }
  return contents.slice(0, at) + replacement + contents.slice(at + anchor.length);
}

const excludeFromPodfile = (contents) => replaceOnce(contents, `${PODFILE_ANCHOR}\n`, `${PODFILE_ANCHOR}(exclude: ['${SAMPLING_MODULE}'])\n`, 'the Podfile');

const excludeFromSettingsGradle = (contents) =>
  replaceOnce(contents, SETTINGS_ANCHOR, `expoAutolinking.exclude = ['${SAMPLING_MODULE}']\n${SETTINGS_ANCHOR}`, 'settings.gradle');

const sampling = () => process.env.EXPO_PUBLIC_RESPONSIVENESS_SAMPLING === '1';
const localBackend = () => (process.env.EXPO_PUBLIC_TABLESIDE_SUPABASE_URL ?? '').startsWith('http:');

function withResponsivenessSampling(config) {
  if (sampling()) {
    if (!localBackend()) return config;
    return withAndroidManifest(config, (mod) => {
      mod.modResults.manifest.application[0].$['android:usesCleartextTraffic'] = 'true';
      return mod;
    });
  }
  config = withPodfile(config, (mod) => {
    mod.modResults.contents = excludeFromPodfile(mod.modResults.contents);
    return mod;
  });
  return withSettingsGradle(config, (mod) => {
    mod.modResults.contents = excludeFromSettingsGradle(mod.modResults.contents);
    return mod;
  });
}

module.exports = withResponsivenessSampling;
module.exports.SAMPLING_MODULE = SAMPLING_MODULE;
module.exports.excludeFromPodfile = excludeFromPodfile;
module.exports.excludeFromSettingsGradle = excludeFromSettingsGradle;
