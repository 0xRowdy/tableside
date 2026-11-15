// Small value encodings shared by the Account service, the web account page's
// client and the app (one copy per runtime; the edge functions keep Deno's).

/** Bytes as lowercase hex. */
export const hex = (bytes: Uint8Array): string => Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');

/** A server timestamp in milliseconds since the epoch, or null when it isn't one. */
export const instant = (value: unknown): number | null => {
  const at = typeof value === 'string' ? Date.parse(value) : Number.NaN;
  return Number.isFinite(at) ? at : null;
};

/** An ISO 4217 currency code, as the server keeps an account's currency. */
export const isCurrency = (value: unknown): value is string => typeof value === 'string' && /^[A-Z]{3}$/.test(value);
