// Lint for the shared packages and tooling. The app has its own config
// (apps/mobile/eslint.config.js, from eslint-config-expo).
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';

const relativeOnly = (allowed = []) => ({
  patterns: [
    {
      regex: `^(?!\\.{1,2}/${allowed.map((name) => `|${name.replace(/[/.]/g, '\\$&')}$`).join('')})`,
      message:
        'Portable packages run unchanged on Hermes and Node: import only relative modules. The app and runner supply adapters.',
    },
  ],
});

const portabilityRules = (allowedImports) => ({
  'no-restricted-imports': ['error', relativeOnly(allowedImports)],
  'no-restricted-globals': [
    'error',
    ...['Date', 'performance'].map((name) => ({ name, message: 'Clocks come from an adapter; game time never enters the engine.' })),
    ...['setTimeout', 'setInterval', 'setImmediate', 'queueMicrotask', 'requestAnimationFrame'].map((name) => ({
      name,
      message: 'The engine is synchronous; the app or runner schedules work.',
    })),
    ...['fetch', 'XMLHttpRequest', 'WebSocket', 'navigator'].map((name) => ({ name, message: 'No network access in the engine.' })),
    ...['localStorage', 'sessionStorage', 'indexedDB'].map((name) => ({ name, message: 'Storage goes through the store port.' })),
    ...['process', 'require', 'Buffer', 'global', 'globalThis', 'window', 'document', 'crypto'].map((name) => ({
      name,
      message: 'Platform globals are not portable between Hermes and Node.',
    })),
    { name: 'Intl', message: 'Locale-dependent formatting differs between runtimes; the app formats for display.' },
  ],
  'no-restricted-properties': [
    'error',
    { object: 'Math', property: 'random', message: 'Randomness comes from the Philox random protocol.' },
  ],
  'no-restricted-syntax': [
    'error',
    { selector: 'ImportExpression', message: 'No dynamic imports: portable packages load only static relative modules.' },
  ],
  'no-console': 'error',
});

export default defineConfig(
  { ignores: ['**/node_modules/**', 'apps/mobile/**', 'harness-reports/**'] },
  ...tseslint.configs.recommended,
  {
    files: ['packages/engine/**/*.ts'],
    rules: portabilityRules([]),
  },
  {
    files: ['packages/engine/test/**/*.ts'],
    rules: { 'no-restricted-imports': ['error', relativeOnly(['@tableside/harness'])] },
  },
  {
    files: ['packages/definitions/**/*.ts'],
    rules: portabilityRules(['@tableside/engine']),
  },
);
