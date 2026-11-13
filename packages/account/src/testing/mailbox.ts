// The captured mailbox: the local stack's mail catcher (Mailpit), which
// receives everything Auth sends locally.

interface MessageSummary {
  readonly ID: string;
}

export class Mailbox {
  constructor(private readonly mailUrl: string) {}

  /** Plain-text bodies of the messages sent to an address, newest first. */
  async messages(email: string): Promise<string[]> {
    const query = encodeURIComponent(`to:"${email}"`);
    const found = (await (await fetch(`${this.mailUrl}/api/v1/search?query=${query}`)).json()) as { messages: MessageSummary[] };
    return Promise.all(
      found.messages.map(async ({ ID }) => ((await (await fetch(`${this.mailUrl}/api/v1/message/${ID}`)).json()) as { Text: string }).Text),
    );
  }

  /**
   * The code in the newest message to an address, waiting briefly for it to
   * arrive. With `after`, waits for a code other than that one.
   */
  async latestCode(email: string, options: { readonly after?: string } = {}): Promise<string> {
    for (let attempt = 0; attempt < 50; attempt++) {
      const [newest] = await this.messages(email);
      const code = newest && /\b(\d{6})\b/.exec(newest)?.[1];
      if (code && code !== options.after) return code;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error(`No new code arrived for ${email}.`);
  }
}
