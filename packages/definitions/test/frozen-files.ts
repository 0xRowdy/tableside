// Reads the frozen research files straight from disk for use as test fixtures.
// Deliberately independent of the shipped parser in src/blackjack.
import { readFileSync } from 'node:fs';

export const REFERENCE_DIR = new URL('../reference/blackjack/', import.meta.url);

export type Row = Record<string, string>;

/** RFC 4180 rows (CRLF, double-quoted fields), keyed by the header line. */
export function frozenRows(file: string): Row[] {
  const text = readFileSync(new URL(file, REFERENCE_DIR), 'utf8');
  const records: string[][] = [];
  let record: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      record.push(field);
      field = '';
    } else if (c === '\n') {
      record.push(field.replace(/\r$/, ''));
      records.push(record);
      record = [];
      field = '';
    } else field += c;
  }
  const [header, ...body] = records;
  if (!header) throw new Error(`${file} is empty`);
  return body.map((values) => Object.fromEntries(header.map((name, i) => [name, values[i] ?? ''])));
}

export const PRESETS = ['S17_LS', 'S17_noLS', 'H17_LS', 'H17_noLS'] as const;
export const RULES = ['S17', 'H17'] as const;

/** The research files' single-letter actions. */
export const LETTER: Record<string, string> = { H: 'hit', S: 'stand', D: 'double', P: 'split', R: 'surrender' };

export const orNull = (value: string | undefined): number | null => (value ? Number(value) : null);
