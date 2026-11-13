import type { CodeRequestResult } from '@tableside/account';

/** "30 seconds", "2 minutes", "1 hour": how long to wait, rounded up. */
export function waitText(seconds: number): string {
  if (seconds < 60) return `${Math.max(1, Math.ceil(seconds))} ${Math.ceil(seconds) === 1 ? 'second' : 'seconds'}`;
  const minutes = Math.ceil(seconds / 60);
  if (minutes < 60) return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`;
  const hours = Math.ceil(minutes / 60);
  return `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
}

/**
 * What the player reads when a code request didn't send. The same whether or
 * not the address has an account: the service answers the same either way.
 */
export function codeRequestProblem(result: Exclude<CodeRequestResult, { status: 'sent' | 'age-required' }>): string {
  return result.status === 'rate-limited'
    ? `Wait ${waitText(result.retryAfterSeconds)} before requesting another code.`
    : "We couldn't send the email. Check the address and your connection, then try again.";
}
