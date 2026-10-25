// Fails when player copy in apps/mobile/src uses a term CONTEXT.md lists
// under "Avoid". Copy is JSX text and string literals that read as words (a
// space or a capital letter), so identifiers like 'alert' pass. Phrases in
// glossary-copy-allowlist.json are final-frame copy and pass, matched exactly.
//
// Checked: avoided terms with no qualifier, or qualified "(as a term)". A
// qualifier like "(unqualified)" or "(for craps or roulette)" needs the
// sentence's context, so reviewers judge those (CODING_STANDARDS.md).

import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import ts from 'typescript';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SOURCE = join(ROOT, 'apps/mobile/src');

// Avoided only as the name of something the glossary names otherwise, so a
// string can't tell: "Choose a game" is fine, a practice session called a game is not.
const CONTEXTUAL = new Set(['game']);

const glossary = readFileSync(join(ROOT, 'CONTEXT.md'), 'utf8');
const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// A capitalised term is a name ("Plus"), matched by case; others match any case.
const pattern = (term) => new RegExp(`\\b${escape(term)}\\b`, /^[A-Z]/.test(term) ? 'g' : 'gi');

// Words inside a defined term ("training bankroll", "Pause") are that term, not the avoided word.
const defined = [...glossary.matchAll(/^\*\*(.+?)\*\*:$/gm)].map(([, term]) => term);
const avoided = [...glossary.matchAll(/^_Avoid_: (.+)$/gm)]
  .flatMap(([, list]) => list.split(/,(?![^(]*\))/))
  .map((item) => /^\s*([^(]+?)\s*(?:\((.+)\))?\s*$/.exec(item))
  .filter((match) => match && (match[2] === undefined || match[2] === 'as a term') && !CONTEXTUAL.has(match[1]))
  .map((match) => match[1]);

const allowed = JSON.parse(readFileSync(join(ROOT, 'scripts/glossary-copy-allowlist.json'), 'utf8')).copy;
// Allowlisted copy matches exactly; defined terms in any case.
const passing = [...allowed.map((phrase) => [phrase, 'g']), ...defined.map((term) => [term, 'gi'])]
  .sort(([a], [b]) => b.length - a.length)
  .map(([phrase, flags]) => new RegExp(escape(phrase), flags));

const files = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === 'testing' ? [] : files(path);
    return /\.tsx?$/.test(entry.name) ? [path] : [];
  });

function copyIn(source) {
  const found = [];
  const visit = (node) => {
    let text = null;
    if (ts.isJsxText(node)) text = node.text;
    else if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      if (!ts.isLiteralTypeNode(node.parent) && !ts.isImportDeclaration(node.parent) && !ts.isExportDeclaration(node.parent)) text = node.text;
    } else if (ts.isTemplateExpression(node)) text = [node.head.text, ...node.templateSpans.map((span) => span.literal.text)].join(' … ');
    if (text !== null && /\s|[A-Z]/.test(text.trim())) found.push({ text, line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1 });
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

const problems = [];
for (const file of files(SOURCE)) {
  const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
  for (const { text, line } of copyIn(source)) {
    const rest = passing.reduce((remaining, phrase) => remaining.replace(phrase, ' '), text);
    for (const term of avoided) if (pattern(term).test(rest)) problems.push(`${relative(ROOT, file)}:${line}  "${term}" in ${JSON.stringify(text)}`);
  }
}

if (problems.length > 0) {
  console.error('Player copy uses terms CONTEXT.md avoids. Use the glossary term, or add final-frame copy to scripts/glossary-copy-allowlist.json:');
  for (const problem of problems) console.error(`  ${problem}`);
  process.exit(1);
}
