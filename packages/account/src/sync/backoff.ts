// Spec 2 Retries

export const BACKOFF_FIRST_MS = 1_000;
export const BACKOFF_MAX_MS = 5 * 60_000;

export function backoffDelay(failures: number, random: () => number): number {
  const step = Math.min(BACKOFF_MAX_MS, BACKOFF_FIRST_MS * 2 ** Math.max(0, failures - 1));
  return Math.round(step / 2 + (random() * step) / 2);
}
