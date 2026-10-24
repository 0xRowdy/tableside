const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  { ignores: ['dist/*', 'ios/*', 'android/*'] },
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/play/units.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.name='BigInt']",
          message: 'Money in the app goes through src/play/units.ts: use or add a helper there instead of calling BigInt.',
        },
      ],
    },
  },
]);
