const MAX_LENGTH = 100;

const DIRECTIVE = /^(eslint(-disable(-next-line|-line)?|-enable)?\s|globals?\s|@ts-(expect-error|ignore|nocheck|check)\b|@(vitest|jest)-environment\s|prettier-ignore\b|(istanbul|c8) ignore\b)/;
const TRIPLE_SLASH = /^\/\s*<reference\s/;
const REFERENCE = /^([Ss]pec \d+|ADR \d+|#\d+\b|docs\/\S+|TODO\((#\d+|[Ss]pec \d+[^)]*)\)$|shortcut: #\d+$)/;

const MESSAGE =
  'Comments are references (CODING_STANDARDS.md): one line citing a spec section, ADR, issue or docs/ page, ' +
  'like `// Spec 2 Deletion, Amendment 9 §3`, `// TODO(#123)` or `// shortcut: #123`. ' +
  'Say the rest with a name, a type or a test. A workaround that needs explaining needs its root cause fixed, or an issue.';

const allowed = (comment) => {
  if (comment.type === 'Shebang') return true;
  const text = comment.value.trim();
  if (DIRECTIVE.test(text) || TRIPLE_SLASH.test(comment.value)) return true;
  if (comment.loc.start.line !== comment.loc.end.line) return false;
  return text.length <= MAX_LENGTH && REFERENCE.test(text);
};

export default {
  meta: { name: 'comments' },
  rules: {
    'reference-only': {
      meta: { type: 'suggestion', schema: [], messages: { reference: MESSAGE } },
      create(context) {
        return {
          Program() {
            for (const comment of context.sourceCode.getAllComments()) {
              if (!allowed(comment)) context.report({ loc: comment.loc, messageId: 'reference' });
            }
          },
        };
      },
    },
  },
};
