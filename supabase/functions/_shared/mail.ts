// Spec 2 Transactional email; #122

import { serviceRpc } from './service.ts';

declare const Deno: { env: { get(name: string): string | undefined } };

const MAILPIT_URL = Deno.env.get('TABLESIDE_MAILPIT_URL');

export interface Mail {
  readonly subject: string;
  readonly text: string;
  readonly html: string;
}

export async function deliver(to: string, mail: Mail, from: 'codes' | 'security' = 'codes'): Promise<boolean> {
  if (!MAILPIT_URL) return false;
  try {
    const response = await fetch(`${MAILPIT_URL}/api/v1/send`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        From: { Email: `${from}@tableside.local`, Name: 'Tableside' },
        To: [{ Email: to }],
        Subject: mail.subject,
        Text: mail.text,
        HTML: mail.html,
      }),
    });
    await response.body?.cancel();
    return response.ok;
  } catch {
    return false;
  }
}

export function codeMail(code: string, purpose = 'Your Tableside code'): Mail {
  return {
    subject: purpose,
    text: `Your Tableside code is ${code}.\n\nIt works once and expires soon. If you didn't ask for it, you can ignore this email.`,
    html: `<p>Your Tableside code is <strong>${code}</strong>.</p><p>It works once and expires soon. If you didn't ask for it, you can ignore this email.</p>`,
  };
}

export async function sendSecurityNotice(environment: string, to: string | null | undefined, mail: Mail, type: string): Promise<void> {
  const delivered = to ? await deliver(to, mail, 'security') : false;
  try {
    const logged = await serviceRpc(environment, 'log_email_send', { type, pacing: 'immediate', outcome: delivered ? 'sent' : 'failed' });
    await logged.body?.cancel();
  } catch {
    console.error('security notice log failed');
  }
}

export function devicesSignedOutMail(devices: number, method?: string): Mail {
  const what = devices === 1 ? 'A device was' : `${devices} devices were`;
  const why = method ? `${method} stopped vouching for your Tableside account, so it was removed as a way to sign in. ` : '';
  const signedOut =
    devices === 0
      ? ''
      : `${what} signed out of your Tableside account. ${devices === 1 ? 'It keeps its' : 'They keep their'} records, locked, until someone signs in to the account again.`;
  const text =
    `${why}${signedOut}`.trim() +
    "\n\nIf this was you, there's nothing to do. If it wasn't, open Tableside, check More → Settings → Account → Devices " +
    'and Sign-in methods, and contact support.';
  return {
    subject: method ? 'A sign-in method was turned off for your account' : devices === 1 ? 'A device was signed out of your account' : 'Devices were signed out of your account',
    text,
    html: text
      .split('\n\n')
      .map((paragraph) => `<p>${paragraph}</p>`)
      .join(''),
  };
}

// Spec 2 Amendment 1 C2; #103
export function deletionScheduledMail(deadline: string): Mail {
  const on = new Date(deadline).toUTCString().replace(/ \d\d:\d\d:\d\d GMT$/, '');
  const text =
    `Your Tableside account is scheduled for permanent deletion on ${on}. Until then you can't use it, your public content is hidden, ` +
    'and your data is kept.\n\n' +
    'To keep your account, open Tableside, sign in and choose Cancel deletion before that date.\n\n' +
    "Deleting your account doesn't cancel a subscription: billing continues until you cancel it in the App Store or Google Play.\n\n" +
    "If you didn't ask for this, cancel deletion in Tableside and contact support.";
  return {
    subject: 'Your Tableside account is scheduled for deletion',
    text,
    html: text
      .split('\n\n')
      .map((paragraph) => `<p>${paragraph}</p>`)
      .join(''),
  };
}

// Spec 2 Amendment 1 C2; #104
export function deletionAcceptedMail(cleanupBy: string): Mail {
  const by = new Date(cleanupBy).toUTCString().replace(/ \d\d:\d\d:\d\d GMT$/, '');
  const text =
    "Your Tableside account is being deleted permanently, as asked. This can't be undone: the account can't be restored, " +
    `and its data is erased from Tableside by ${by}. Once that's done, signing up again with this address makes a new, empty account.\n\n` +
    "Deleting your account doesn't cancel a subscription: cancel it in the App Store or Google Play, where you can also ask for a refund.\n\n" +
    "If you didn't ask for this, contact support.";
  return {
    subject: 'Your Tableside account is being deleted',
    text,
    html: text
      .split('\n\n')
      .map((paragraph) => `<p>${paragraph}</p>`)
      .join(''),
  };
}

export function exportReadyMail(expiresAt: string): Mail {
  const until = new Date(expiresAt).toUTCString().replace(/:\d\d GMT$/, ' UTC');
  const text =
    'Your Tableside account archive is ready. To download it, open Tableside and go to More → Settings → Account → Export my data. ' +
    `It's available until ${until}; after that you can ask for a new one.\n\n` +
    "If you didn't ask for it, sign out your other devices in Tableside (Account → Devices) and contact support.";
  return {
    subject: 'Your Tableside account archive is ready',
    text,
    html: text
      .split('\n\n')
      .map((paragraph) => `<p>${paragraph}</p>`)
      .join(''),
  };
}
