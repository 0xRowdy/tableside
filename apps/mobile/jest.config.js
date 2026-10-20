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
  // Above Jest's 5 s default for RNTL's async renders; the app shell test warms up
  // the route tree in beforeAll, which has its own longer timeout.
  testTimeout: 30_000,
  projects: [project('ios'), project('android')],
};
