// Spec 1 Launch gates 5; #121; docs/development.md Responsiveness sampling
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { parseExport, responsivenessReport, type ResponsivenessSample } from '../src/responsiveness/samples';

const files = process.argv.slice(2).filter((arg) => arg !== '--');
if (files.length === 0) {
  console.error('Usage: pnpm --filter @tableside/mobile responsiveness-report <export.jsonl> [more exports…]');
  process.exit(2);
}

const from = process.env.INIT_CWD ?? process.cwd();
const samples: ResponsivenessSample[] = files.flatMap((file) => {
  const path = resolve(from, file);
  try {
    return parseExport(readFileSync(path, 'utf8'));
  } catch (error) {
    console.error(`${path}: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
});

const { rows, text } = responsivenessReport(samples);
console.log(text);
process.exitCode = rows.some((row) => row.result === 'fail' || row.tooFew) ? 1 : 0;
