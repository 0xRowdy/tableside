const project = (platform) => {
  const preset = require(`jest-expo/${platform}/jest-preset`);
  return {
    displayName: platform,
    preset: `jest-expo/${platform}`,
    setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
    testPathIgnorePatterns: ['/node_modules/', '/ios/', '/android/'],
    transform: { ...preset.transform, '\\.mjs$': preset.transform['\\.[jt]sx?$'] },
    transformIgnorePatterns: preset.transformIgnorePatterns.map((pattern) =>
      pattern.replace('(.pnpm|', '(.pnpm|lucide-react-native|'),
    ),
  };
};

module.exports = {
  testTimeout: 30_000,
  projects: [project('ios'), project('android')],
};
