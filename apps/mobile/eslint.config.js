const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

const comments = require('../../scripts/eslint/reference-comments.mjs').default;
const { default: games, PER_GAME_FILES } = require('../../scripts/eslint/game-branches.mjs');

const GAME_DISPATCH = ['src/app/(tabs)/play.tsx'];
const GAME_BRANCHES_TO_MOVE = ['src/practice/controller.ts', 'src/play/EndSessionDialog.tsx'];

const HOOKS = 'src/hooks/**';
const PLATFORM_ADAPTERS = ['src/practice/app-adapters.ts', 'src/account/device-ports.ts', 'src/account/native-vault.ts'];

const EFFECT_ALTERNATIVES =
  'Use a hook from src/hooks instead: useLoaded (load a value), useFollow (keep a subscription while mounted), usePolling, useMoveFocus, useAnnouncement; or React\'s useSyncExternalStore to read a store. If none fits, move the work into the event handler or controller that changes the state rather than reacting to it; only extend src/hooks when a new intent needs a hook.';

const effects = ['useEffect', 'useLayoutEffect', 'useInsertionEffect'];

const TIMER_ALTERNATIVES =
  'Product code takes timers from a port: usePolling (src/hooks) to repeat work while a condition holds, or a sleep/after/every port injected from a platform adapter (clock.sleep in src/practice/app-adapters.ts, appDevicePorts in src/account/device-ports.ts). Fix the timing at its source rather than working around it.';

module.exports = defineConfig([
  expoConfig,
  { ignores: ['dist/*', 'ios/*', 'android/*'] },
  { plugins: { comments }, rules: { 'comments/reference-only': 'error' } },
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: [...PER_GAME_FILES, ...GAME_DISPATCH, ...GAME_BRANCHES_TO_MOVE],
    plugins: { games },
    rules: { 'games/no-game-branch': 'error' },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: [...PER_GAME_FILES, 'src/play/game-words.ts', 'src/**/recorded/**', 'src/theme/**'],
    plugins: { games },
    rules: { 'games/no-game-words': 'error' },
  },
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
        {
          selector: "CallExpression[callee.name='useFollow'][arguments.0.type=/^(ArrowFunctionExpression|FunctionExpression)$/]",
          message:
            'useFollow takes a named follow function declared outside the component, like followAccountGate(service, controller), so the subscription is testable without React and its arguments are its whole input. An inline function here is a useEffect under another name.',
        },
      ],
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: [HOOKS],
    rules: {
      'no-restricted-imports': ['error', { paths: [{ name: 'react', importNames: effects, message: `Effects live only in src/hooks. ${EFFECT_ALTERNATIVES}` }] }],
      'no-restricted-properties': [
        'error',
        ...effects.map((property) => ({ object: 'React', property, message: `Effects live only in src/hooks. ${EFFECT_ALTERNATIVES}` })),
      ],
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: [HOOKS, ...PLATFORM_ADAPTERS],
    rules: {
      'no-restricted-globals': [
        'error',
        ...['setTimeout', 'setInterval', 'requestAnimationFrame', 'requestIdleCallback'].map((name) => ({ name, message: TIMER_ALTERNATIVES })),
      ],
    },
  },
]);
