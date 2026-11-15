// The mail sender: every email Tableside sends goes out here, synchronously,
// with no retry queue (spec 2, *Transactional email*). Locally it delivers to
// the stack's mail catcher; production sending (Resend) is #122's. Nothing
// here logs an address, code or body.

declare const Deno: { env: { get(name: string): string | undefined } };

/** The local stack's mail catcher (config.toml [edge_runtime.secrets]). */
const MAILPIT_URL = Deno.env.get('TABLESIDE_MAILPIT_URL');

export interface Mail {
  readonly subject: string;
  readonly text: string;
  readonly html: string;
}

/** Sends one email synchronously; false when it wasn't accepted. */
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

/** A sign-in or confirmation code. */
export function codeMail(code: string, purpose = 'Your Tableside code'): Mail {
  return {
    subject: purpose,
    text: `Your Tableside code is ${code}.\n\nIt works once and expires soon. If you didn't ask for it, you can ignore this email.`,
    html: `<p>Your Tableside code is <strong>${code}</strong>.</p><p>It works once and expires soon. If you didn't ask for it, you can ignore this email.</p>`,
  };
}

/**
 * The "devices signed out" security notice: after the player signed devices
 * out, or after a provider withdrew a sign-in method (`method`, its name).
 * It names no device: labels are what each device called itself, so they
 * never vouch for which device it was.
 */
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
