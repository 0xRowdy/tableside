// Spec 2 S2-18

import type { SignInMethod, SignInMethodEntry } from '@tableside/account';

import { PROVIDERS } from './providers';

export function methodName(method: SignInMethod): string {
  return method === 'email' ? 'Email code' : PROVIDERS[method].name;
}

export function methodDetail({ method, email }: SignInMethodEntry): string | undefined {
  if (!email) return undefined;
  if (method === 'email') return `${email} · verified`;
  return /@privaterelay\.appleid\.com$/i.test(email) ? `Hide My Email · ${email}` : email;
}

export function confirmReason(
  change:
    | { readonly kind: 'add' | 'remove'; readonly method: SignInMethod }
    | { readonly kind: 'change-email' }
    | { readonly kind: 'sign-out-devices' }
    | { readonly kind: 'export' }
    | { readonly kind: 'delete-account' }
    | { readonly kind: 'cancel-deletion' },
): string {
  if (change.kind === 'delete-account') {
    return "Deleting your account starts here, so sign in again first. Being signed in already isn't enough for this.";
  }
  if (change.kind === 'cancel-deletion') {
    return "Canceling deletion reopens your account, so sign in again first. Being signed in already isn't enough for this.";
  }
  if (change.kind === 'export') {
    return "An export is a full copy of your data, so sign in again first. Being signed in already isn't enough for this.";
  }
  if (change.kind === 'sign-out-devices') {
    return "Signing out a device changes who can open your account, so sign in again first. Being signed in already isn't enough for this.";
  }
  if (change.kind === 'change-email') {
    return "Changing your sign-in email affects how you get back in, so sign in again first. We'll then confirm both the old and new address.";
  }
  const name = methodName(change.method);
  return change.kind === 'add'
    ? `Adding ${name} changes how you sign in, so sign in again first. Being signed in already isn't enough for this.`
    : `Removing ${name} changes how you sign in, so sign in again first with a method you're keeping. Being signed in already isn't enough for this.`;
}
