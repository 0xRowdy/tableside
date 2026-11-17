// Spec 3 Information hiding (end to end), Testing Decisions › Seam 1, Amendment 1 C5; #132
import type { TestContext } from '@tableside/harness';

const REVEALING_KEYS = new Set(['correct', 'reference', 'explanation', 'feedback', 'results', 'review', 'error', 'prescribed', 'fallback', 'drift', 'items', 'answers', 'future']);

export function revealingFields(view: unknown, path = 'view'): string[] {
  if (Array.isArray(view)) return view.flatMap((value, index) => revealingFields(value, `${path}[${index}]`));
  if (view === null || typeof view !== 'object') return [];
  return Object.entries(view).flatMap(([key, value]) => {
    if (value === null || value === undefined) return [];
    const at = `${path}.${key}`;
    return REVEALING_KEYS.has(key) ? [at] : revealingFields(value, at);
  });
}

export function expectCheckViewHides(t: TestContext, label: string, view: { readonly phase: string }): void {
  t.equal([label, revealingFields(view)], [label, view.phase === 'ended' ? ['view.results'] : []]);
}
