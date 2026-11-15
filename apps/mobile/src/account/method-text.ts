// Player wording for Sign-in methods (S2-18) and Confirm it's you.

import type { SignInMethod, SignInMethodEntry } from '@tableside/account';

import { PROVIDERS } from './providers';

/** "Apple", "Google", "Email code". */
export function methodName(method: SignInMethod): string {
  return method === 'email' ? 'Email code' : PROVIDERS[method].name;
}

/** What a method card says under its name: Apple's relay address as Hide My Email, the email code's address as verified. */
export function methodDetail({ method, email }: SignInMethodEntry): string | undefined {
  if (!email) return undefined;
  if (method === 'email') return `${email} · verified`;
  return /@privaterelay\.appleid\.com$/i.test(email) ? `Hide My Email · ${email}` : email;
}

/** Why Confirm it's you is asked, for each change it guards. */
export function confirmReason(change: { readonly kind: 'add' | 'remove'; readonly method: SignInMethod } | { readonly kind: 'change-email' }): string {
  if (change.kind === 'change-email') {
    return "Changing your sign-in email affects how you get back in, so sign in again first. We'll then confirm both the old and new address.";
  }
  const name = methodName(change.method);
  return change.kind === 'add'
    ? `Adding ${name} changes how you sign in, so sign in again first. Being signed in already isn't enough for this.`
    : `Removing ${name} changes how you sign in, so sign in again first with a method you're keeping. Being signed in already isn't enough for this.`;
}
