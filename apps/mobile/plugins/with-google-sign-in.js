// docs/environments.md Provisioning a project
const { withInfoPlist } = require('expo/config-plugins');

module.exports = function withGoogleSignIn(config) {
  const clientId = process.env.EXPO_PUBLIC_TABLESIDE_GOOGLE_IOS_CLIENT_ID;
  if (!clientId) return config;
  const scheme = clientId.split('.').reverse().join('.');
  return withInfoPlist(config, (plist) => {
    const types = plist.modResults.CFBundleURLTypes ?? [];
    if (!types.some((type) => (type.CFBundleURLSchemes ?? []).includes(scheme))) types.push({ CFBundleURLSchemes: [scheme] });
    plist.modResults.CFBundleURLTypes = types;
    return plist;
  });
};
