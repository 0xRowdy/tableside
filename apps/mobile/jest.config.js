// Every app test runs against both platforms' React Native behavior.
const project = (platform) => {
  const preset = require(`jest-expo/${platform}/jest-preset`);
  return {
    displayName: platform,
    preset: `jest-expo/${platform}`,
    setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
    testPathIgnorePatterns: ['/node_modules/', '/ios/', '/android/'],
    // lucide-react-native ships ES modules only (.mjs).
    transform: { ...preset.transform, '\\.mjs$': preset.transform['\\.[jt]sx?$'] },
    transformIgnorePatterns: preset.transformIgnorePatterns.map((pattern) =>
      pattern.replace('(.pnpm|', '(.pnpm|lucide-react-native|'),
    ),
  };
};

module.exports = {
  // The first render transforms the whole route tree, which is slow on a cold cache (as in CI).
  testTimeout: 30_000,
  projects: [project('ios'), project('android')],
};
