// Retry pacing (spec 2, *Retries*): jittered exponential backoff from about
// 1 s up to 5 min. Each step doubles; the wait is a random point in the second
// half of its step, so devices that failed together don't retry together.

export const BACKOFF_FIRST_MS = 1_000;
export const BACKOFF_MAX_MS = 5 * 60_000;

/** The wait after the `failures`-th consecutive failure (1 or more), given a uniform random number in [0, 1). */
export function backoffDelay(failures: number, random: () => number): number {
  const step = Math.min(BACKOFF_MAX_MS, BACKOFF_FIRST_MS * 2 ** Math.max(0, failures - 1));
  return Math.round(step / 2 + (random() * step) / 2);
}
