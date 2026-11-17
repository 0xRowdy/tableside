const GAMES = new Set(['blackjack', 'craps', 'roulette']);
const GAME_KEYS = new Set(['game', 'id']);

const MESSAGE =
  'Game-specific rules live behind the engine GameModule (packages/engine/src/activity.ts), and app wording in ' +
  'apps/mobile/src/play/game-words.ts (CODING_STANDARDS.md). Add what this branch needs to the game module, GAME_WORDS ' +
  'or a per-game file (blackjack-*, Craps*, …) and call it here, so a new game touches one module.';

export const PER_GAME_FILES = ['**/{blackjack,craps,roulette}*', '**/{Blackjack,Craps,Roulette}*'];

const gameKey = (node) => {
  const member = node?.type === 'ChainExpression' ? node.expression : node;
  return member?.type === 'MemberExpression' && !member.computed && GAME_KEYS.has(member.property.name);
};
const gameLiteral = (node) => node?.type === 'Literal' && GAMES.has(node.value);

const TURN_WORDS = /\b(spins?|spun|rolls?|rolled|rounds?|deals?|dealt)\b/i;
const WORDS_MESSAGE =
  'A shared screen says each game\'s own word for a turn ("spin", "roll", "round"): take it from GAME_WORDS in ' +
  'apps/mobile/src/play/game-words.ts, adding a field there if none fits (CODING_STANDARDS.md), or move this text into a per-game file.';

export default {
  meta: { name: 'games' },
  rules: {
    'no-game-branch': {
      meta: { type: 'problem', schema: [], messages: { branch: MESSAGE } },
      create(context) {
        return {
          BinaryExpression(node) {
            if (!['===', '!==', '==', '!='].includes(node.operator)) return;
            if ((gameKey(node.left) && gameLiteral(node.right)) || (gameKey(node.right) && gameLiteral(node.left))) {
              context.report({ node, messageId: 'branch' });
            }
          },
          SwitchCase(node) {
            if (gameLiteral(node.test) && gameKey(node.parent.discriminant)) context.report({ node, messageId: 'branch' });
          },
        };
      },
    },
    'no-game-words': {
      meta: { type: 'problem', schema: [], messages: { words: WORDS_MESSAGE } },
      create(context) {
        const check = (node, text) => {
          if (TURN_WORDS.test(text)) context.report({ node, messageId: 'words' });
        };
        const readsAsCopy = (text) => typeof text === 'string' && /\S\s+\S|[A-Z]/.test(text);
        return {
          Literal: (node) => node.parent.type !== 'TSLiteralType' && readsAsCopy(node.value) && check(node, node.value),
          TemplateElement: (node) => readsAsCopy(node.value.cooked) && check(node, node.value.cooked),
          JSXText: (node) => check(node, node.value),
        };
      },
    },
  },
};
