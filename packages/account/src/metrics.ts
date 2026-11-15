// What the client may send, by purpose, given the account gate (spec 2,
// *Observability* and Amendment 1 C4). Before eligibility is established, only
// what eligibility, security and recovery need. The privacy boundary (#108)
// lists the permitted metrics and minimizes teen ones; privacy choices (#105)
// hold the adult opt-in. This is only the eligibility half: every sender asks it first.

import type { AccountGate } from './service';

export type MetricPurpose = 'eligibility' | 'security' | 'recovery' | 'operational' | 'product-analytics';

const BEFORE_ELIGIBILITY: ReadonlySet<MetricPurpose> = new Set(['eligibility', 'security', 'recovery']);

/** Whether the gate lets the client send a metric or event of this purpose. */
export function metricPermitted(gate: AccountGate, purpose: MetricPurpose): boolean {
  if (BEFORE_ELIGIBILITY.has(purpose)) return true;
  if (gate.state !== 'active' && gate.state !== 'renewal-pending') return false;
  // No optional product analytics for teens (spec 7); adults still need their opt-in (#105).
  return purpose !== 'product-analytics' || gate.eligibility === '18+';
}
