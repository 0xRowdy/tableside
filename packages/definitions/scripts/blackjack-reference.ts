// docs/development.md Blackjack reference
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const REFERENCE_DIR = fileURLToPath(new URL('../reference/blackjack/', import.meta.url));
export const MODULE_PATH = fileURLToPath(new URL('../src/blackjack/reference-files.generated.ts', import.meta.url));

export const MANIFEST_SHA256 = '9892826d10a6d3772504f0b5a929df850dba97e899352c18f86887a4085103d0';

export const SHIPPED_FILES = {
  'basic_S17_LS.csv': 'basic_tables',
  'basic_S17_noLS.csv': 'basic_tables',
  'basic_H17_LS.csv': 'basic_tables',
  'basic_H17_noLS.csv': 'basic_tables',
  'continuation_S17.csv': 'continuation_tables',
  'continuation_H17.csv': 'continuation_tables',
  'indices_S17_final.csv': 'final_indices',
  'indices_H17_final.csv': 'final_indices',
} as const;

const sha256 = (bytes: Buffer | string) => createHash('sha256').update(bytes).digest('hex');

export function referenceProblems(dir = REFERENCE_DIR): string[] {
  const manifestBytes = readFileSync(`${dir}/reference-manifest.json`);
  if (sha256(manifestBytes) !== MANIFEST_SHA256) {
    return ['reference-manifest.json differs from the manifest frozen at ae3776d'];
  }
  const manifest = JSON.parse(manifestBytes.toString('utf8')) as { frozen_files: Record<string, Record<string, string>> };
  const problems: string[] = [];
  for (const [file, group] of Object.entries(SHIPPED_FILES)) {
    const expected = manifest.frozen_files[group]?.[file];
    const actual = sha256(readFileSync(`${dir}/${file}`));
    if (actual !== expected) problems.push(`${file}: SHA-256 ${actual} does not match the manifest (${expected ?? 'missing'})`);
  }
  return problems;
}

export function renderModule(dir = REFERENCE_DIR): string {
  const entries = Object.keys(SHIPPED_FILES).map((file) => {
    const text = readFileSync(`${dir}/${file}`, 'utf8');
    return `  '${file}': {\n    sha256: '${sha256(text)}',\n    text: ${JSON.stringify(text)},\n  },\n`;
  });
  const manifest = sha256(readFileSync(`${dir}/reference-manifest.json`));
  return (
    '// docs/development.md Blackjack reference\n' +
    `export const REFERENCE_MANIFEST_SHA256 = '${manifest}';\n` +
    `export const REFERENCE_FILES = {\n${entries.join('')}} as const;\n`
  );
}

export function buildProblems(dir = REFERENCE_DIR, modulePath = MODULE_PATH): string[] {
  const problems = referenceProblems(dir);
  if (problems.length > 0) return problems;
  let shipped: string;
  try {
    shipped = readFileSync(modulePath, 'utf8');
  } catch {
    shipped = '';
  }
  return shipped === renderModule(dir)
    ? []
    : ['src/blackjack/reference-files.generated.ts does not embed the frozen files; run reference:write'];
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const command = process.argv[2];
  if (command === 'write') {
    const problems = referenceProblems();
    if (problems.length === 0) writeFileSync(MODULE_PATH, renderModule());
    report(problems);
  } else if (command === 'check') {
    report(buildProblems());
  } else {
    console.error('usage: blackjack-reference.ts check|write');
    process.exit(2);
  }
}

function report(problems: string[]): void {
  for (const problem of problems) console.error(`blackjack reference: ${problem}`);
  if (problems.length > 0) process.exit(1);
  console.log('blackjack reference: every file matches reference-manifest.json');
}
