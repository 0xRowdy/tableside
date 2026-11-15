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
