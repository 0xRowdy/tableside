// Canonical JSON for checkpoints: object keys sorted by UTF-16 code units, no
// whitespace, and only values every runtime encodes the same way (strings,
// finite numbers, booleans, null, arrays and plain objects).

export function canonicalJson(value: unknown): string {
  switch (typeof value) {
    case 'string':
    case 'boolean':
      return JSON.stringify(value);
    case 'number':
      if (!Number.isFinite(value)) throw new TypeError(`cannot encode non-finite number ${value}`);
      return JSON.stringify(Object.is(value, -0) ? 0 : value);
    case 'object': {
      if (value === null) return 'null';
      if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
      const prototype = Object.getPrototypeOf(value) as unknown;
      if (prototype !== Object.prototype && prototype !== null) throw new TypeError('cannot encode a class instance');
      const record = value as Record<string, unknown>;
      const keys = Object.keys(record).sort();
      return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(',')}}`;
    }
    default:
      throw new TypeError(`cannot encode ${typeof value}`);
  }
}
