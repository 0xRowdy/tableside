// Lint for the shared packages and tooling. The app has its own config
// (apps/mobile/eslint.config.js, from eslint-config-expo).
import path from 'node:path';

import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';

// no-restricted-imports only sees the specifier, so it can't tell `../src/x`
// (same package) from `../../harness/src/x` (another package's internals).
const portability = {
  rules: {
    'no-relative-outside-package': {
      meta: { type: 'problem', schema: [] },
      create(context) {
        const parts = context.filename.split(path.sep);
        const at = parts.lastIndexOf('packages');
        if (at < 0) return {};
        const packageRoot = parts.slice(0, at + 2).join(path.sep);
        const check = (node) => {
          const specifier = node.source?.value;
          if (typeof specifier !== 'string' || !specifier.startsWith('.')) return;
          const target = path.relative(packageRoot, path.resolve(path.dirname(context.filename), specifier));
          if (target.startsWith('..') || path.isAbsolute(target)) {
            context.report({ node: node.source, message: 'Relative imports stay inside this package; import other packages by name.' });
          }
        };
        return { ImportDeclaration: check, ExportNamedDeclaration: check, ExportAllDeclaration: check };
      },
    },
  },
};

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
  'portability/no-relative-outside-package': 'error',
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
  { ignores: ['**/node_modules/**', 'apps/mobile/**', 'harness-reports/**', '.claude/**'] },
  ...tseslint.configs.recommended,
  { files: ['packages/engine/**/*.ts', 'packages/definitions/**/*.ts'], plugins: { portability } },
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
  {
    // Build-time checks and tests of the definitions package, and the engine's
    // checkpoint recorder, run on Node and never ship; only src/ (and the
    // engine's cross-runtime suite) must stay portable.
    files: ['packages/definitions/scripts/**/*.ts', 'packages/definitions/test/**/*.ts', 'packages/engine/scripts/**/*.ts'],
    rules: {
      'no-restricted-imports': 'off',
      'portability/no-relative-outside-package': 'error',
      'no-restricted-globals': 'off',
      'no-console': 'off',
    },
  },
);
