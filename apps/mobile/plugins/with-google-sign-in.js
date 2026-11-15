// Native Sign in with Google on iOS (modules/google-sign-in) returns to the
// app through the iOS OAuth client's reversed client ID as a URL scheme. The
// client ID is a build-time setting (docs/environments.md); a build without
// it has no Google sign-in on iOS, and nothing is added.
const { withInfoPlist } = require('expo/config-plugins');

module.exports = function withGoogleSignIn(config) {
  const clientId = process.env.EXPO_PUBLIC_TABLESIDE_GOOGLE_IOS_CLIENT_ID;
  if (!clientId) return config;
  // 123-abc.apps.googleusercontent.com → com.googleusercontent.apps.123-abc
  const scheme = clientId.split('.').reverse().join('.');
  return withInfoPlist(config, (plist) => {
    const types = plist.modResults.CFBundleURLTypes ?? [];
    if (!types.some((type) => (type.CFBundleURLSchemes ?? []).includes(scheme))) types.push({ CFBundleURLSchemes: [scheme] });
    plist.modResults.CFBundleURLTypes = types;
    return plist;
  });
};
