// Confirm it's you and sign-in methods (S2-18): adding Apple, Google or the
// email code, removing one, and Secure Email Change. Every change needs Confirm
// it's you first, and the account always keeps a method.

import { freshCodeAnswer, freshProviderAnswer } from '../lifecycle-answers';

import type { PlayerAnswer, ServiceContext } from './context';
import type { SignIn } from './sign-in';
import { type FreshAuthentication, type LinkResult, type SignInMethods, opensOrdinaryAccess, opensRestrictedPaths } from './types';

type LinkAnswer = Extract<LinkResult, { status: 'linked' | 'already-linked' | 'conflict' | 'fresh-authentication-required' }>;

const linkAnswer = (answer: PlayerAnswer | null): LinkAnswer | null => {
  const status = answer?.status;
  if (answer?.code === 200 && (status === 'linked' || status === 'already-linked')) return { status };
  if (answer?.code === 409 && status === 'conflict') return { status };
  if (answer?.code === 403 && status === 'fresh-authentication-required') return { status };
  return null;
};

export function createMethods(ctx: ServiceContext, signIn: SignIn): { readonly freshAuthentication: FreshAuthentication; readonly signInMethods: SignInMethods } {
  /** An email change under way: its two addresses, and which of them has confirmed. Memory only. */
  let emailChange: { readonly current: string; readonly new: string; currentConfirmed: boolean; newConfirmed: boolean } | null = null;

  // On the restricted paths too: an age-restricted account confirms before it exports.
  const freshAuthentication: FreshAuthentication = {
    async methods() {
      return signIn.parseMethods(await ctx.operation('fresh_authentication_methods_v1', undefined, 'restricted'));
    },
    async withProvider(provider) {
      if (!opensRestrictedPaths(ctx.gate)) return { status: 'failed' };
      try {
        const proven = await signIn.providerProof(provider);
        if (typeof proven === 'string') return { status: proven };
        const answer = await ctx.actAsPlayer('fresh-auth', { method: 'provider', ...proven.proof }, 'restricted');
        return freshProviderAnswer(answer?.code, answer?.status);
      } catch {
        return { status: 'failed' };
      }
    },
    async requestCode() {
      const caller = (await ctx.operation('caller_session_v1', undefined, 'restricted')) as { email?: unknown } | null;
      return typeof caller?.email === 'string' ? signIn.sendCode({ email: caller.email, intent: 'sign-in' }) : { status: 'failed' };
    },
    async withCode(code) {
      const answer = await ctx.actAsPlayer('fresh-auth', { method: 'email', code: code.trim() }, 'restricted');
      return freshCodeAnswer(answer?.code, answer?.status);
    },
  };

  const signInMethods: SignInMethods = {
    async list() {
      return signIn.parseMethods(await ctx.operation('sign_in_methods_v1'));
    },
    async link(provider) {
      if (!opensOrdinaryAccess(ctx.gate)) return { status: 'failed' };
      try {
        const proven = await signIn.providerProof(provider);
        if (typeof proven === 'string') return { status: proven };
        const linked = linkAnswer(await ctx.actAsPlayer('link-method', { method: 'provider', ...proven.proof }));
        // A method added: its grant is kept too, for permanent deletion to revoke.
        if (linked?.status === 'linked' || linked?.status === 'already-linked') await signIn.keepGrant(proven.credential);
        return linked ?? { status: 'failed' };
      } catch {
        return { status: 'failed' };
      }
    },
    async requestEmailMethodCode() {
      const answer = await ctx.actAsPlayer('link-method', { method: 'email', step: 'send' });
      if (answer?.code === 200 && answer.status === 'sent') return { status: 'sent' };
      if (answer?.code === 429 && typeof answer.retryAfter === 'number') return { status: 'rate-limited', retryAfterSeconds: answer.retryAfter };
      if (answer?.code === 403 && answer.status === 'fresh-authentication-required') return { status: answer.status };
      return { status: 'failed' };
    },
    async confirmEmailMethod(code) {
      const answer = await ctx.actAsPlayer('link-method', { method: 'email', code: code.trim() });
      if (answer?.code === 401 && answer.status === 'invalid-code') return { status: 'invalid-code' };
      const linked = linkAnswer(answer);
      return linked?.status === 'conflict' || !linked ? { status: 'failed' } : linked;
    },
    async remove(id) {
      const status = ((await ctx.operation('remove_sign_in_method_v1', { identity: id })) as { status?: unknown } | null)?.status;
      return status === 'removed' || status === 'last-method' || status === 'confirm-with-another-method' || status === 'fresh-authentication-required'
        ? { status }
        : { status: 'failed' };
    },
    async changeEmail(email) {
      const address = email.trim();
      const at = ctx.generation;
      const status = ((await ctx.operation('authorize_email_change_v1', { new_email: address })) as { status?: unknown } | null)?.status;
      if (status === 'fresh-authentication-required' || status === 'same-address' || status === 'invalid') return { status };
      if (status !== 'authorized') return { status: 'failed' };
      try {
        const token = await ctx.bearer();
        if (!token) return { status: 'failed' };
        // Auth emails both addresses through the send-email hook.
        const { ok, body } = await ctx.authRequest('PUT', '/user', { email: address }, token);
        if (at !== ctx.generation) return { status: 'failed' };
        if (!ok) return { status: body?.error_code === 'email_exists' ? 'in-use' : 'failed' };
        const current = typeof body?.email === 'string' ? body.email : null;
        if (!current) return { status: 'failed' };
        emailChange = { current, new: address, currentConfirmed: false, newConfirmed: false };
        return { status: 'codes-sent' };
      } catch {
        return { status: 'failed' };
      }
    },
    async confirmEmailChange({ currentCode, newCode }) {
      const change = emailChange;
      if (!change || !opensOrdinaryAccess(ctx.gate)) return { status: 'failed' };
      try {
        for (const [address, email, code] of [
          ['current', change.current, currentCode],
          ['new', change.new, newCode],
        ] as const) {
          const confirmed = address === 'current' ? 'currentConfirmed' : 'newConfirmed';
          if (change[confirmed]) continue;
          const { ok, body } = await ctx.authRequest('POST', '/verify', { type: 'email_change', email, token: code.trim() });
          if (!ok) return body?.error_code === 'otp_expired' ? { status: 'invalid-code', address } : { status: 'failed' };
          change[confirmed] = true;
          // Confirming the second address signs in as well: that session is ended at once, so only this device's own stays.
          if (typeof body?.access_token === 'string') await ctx.authRequest('POST', '/logout?scope=local', {}, body.access_token);
        }
        emailChange = null;
        return { status: 'changed' };
      } catch {
        return { status: 'failed' };
      }
    },
  };

  return { freshAuthentication, signInMethods };
}
