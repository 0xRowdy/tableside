// A minimal RFC 4180 reader for the embedded reference files: CRLF records,
// double-quoted fields that may hold commas. Rows are keyed by the header.

export type CsvRow = Readonly<Record<string, string>>;

export function parseCsv(text: string): CsvRow[] {
  const records: string[][] = [];
  let record: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text.charAt(i);
    if (quoted) {
      if (c !== '"') field += c;
      else if (text.charAt(i + 1) === '"') {
        field += '"';
        i++;
      } else quoted = false;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      record.push(field);
      field = '';
    } else if (c === '\r' && text.charAt(i + 1) === '\n') {
      // the record ends at the \n
    } else if (c === '\n') {
      record.push(field);
      records.push(record);
      record = [];
      field = '';
    } else field += c;
  }
  if (field !== '' || record.length > 0) {
    record.push(field);
    records.push(record);
  }
  const [header, ...body] = records;
  if (header === undefined) return [];
  return body.map((values) => {
    if (values.length !== header.length) throw new Error(`CSV record has ${values.length} fields, header has ${header.length}`);
    return Object.fromEntries(header.map((name, i) => [name, values[i] ?? '']));
  });
}
