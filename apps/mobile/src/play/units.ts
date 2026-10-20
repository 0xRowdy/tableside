// Amounts on screen are plain units (no currency symbol), shared by every
// table. Formatting never changes a ledger value.

/** Canonical money text with thousands separators: "1000" → "1,000", "-2.5" → "-2.5". */
export function formatUnits(amount: string): string {
  const negative = amount.startsWith('-');
  const [whole = '0', fraction] = (negative ? amount.slice(1) : amount).split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${negative ? '-' : ''}${grouped}${fraction ? `.${fraction}` : ''}`;
}
