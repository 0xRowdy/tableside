// Live updates (spec 2, *Timing*; #50's Realtime amendment): while
// foregrounded and connected, a device joins its account's private Realtime
// topic, which carries only an "account changed" hint. The newest foregrounded
// device holds the connection: each device that joins claims it, the server
// tells every joined device the newest claim, and older holders leave. Devices
// without the connection, and connections that are refused, rely on the 60 s
// reconciliation. A hint only prompts a reconcile; it is never the record of a change.

export type LiveChannelStatus = 'joined' | 'closed';

/** One connection to the account's private topic. */
export interface LiveChannel {
  /** Joins; `closed` reports a refused, failed or lost connection. */
  join(handlers: {
    readonly hint: () => void;
    /** The newest claim, as the server announces it. */
    readonly holder: (claim: number) => void;
    readonly status: (status: LiveChannelStatus) => void;
  }): void;
  /** Claims the live connection for this device; resolves to the claim number. */
  claim(): Promise<number>;
  leave(): void;
}

export class LiveUpdates {
  private channel: LiveChannel | null = null;
  private claim: number | null = null;
  /** The newest claim announced on the current connection. */
  private newest = 0;
  private joined = false;
  private ended = false;

  constructor(
    private readonly connect: () => LiveChannel,
    private readonly onHint: () => void,
  ) {}

  /** Whether this device holds the live connection now. */
  get live(): boolean {
    return this.channel !== null && this.joined && this.claim !== null;
  }

  /** Foregrounded and connected: join and claim. No-op while already joined or joining. */
  start(): void {
    if (this.ended || this.channel) return;
    const channel = this.connect();
    this.channel = channel;
    this.claim = null;
    this.newest = 0;
    this.joined = false;
    channel.join({
      hint: () => {
        if (this.channel === channel) this.onHint();
      },
      holder: (claim) => {
        if (this.channel !== channel) return;
        this.newest = Math.max(this.newest, claim);
        // A newer device took over: give the connection up and use the 60 s path.
        if (this.claim !== null && claim > this.claim) this.close();
      },
      status: (status) => {
        if (this.channel !== channel) return;
        if (status === 'closed') return this.close();
        this.joined = true;
        channel.claim().then(
          (claim) => {
            if (this.channel !== channel) return;
            // Overtaken before the claim's answer arrived.
            if (claim < this.newest) return this.close();
            this.claim = claim;
          },
          () => {
            if (this.channel === channel) this.close();
          },
        );
      },
    });
  }

  /** Backgrounded or offline: leave. */
  close(): void {
    const channel = this.channel;
    this.channel = null;
    this.claim = null;
    this.joined = false;
    channel?.leave();
  }

  /** The credentials changed: join again with the new ones, if joined. */
  renew(): void {
    if (!this.channel) return;
    this.close();
    this.start();
  }

  /** The account session ended (sign-out or account switch): leave for good. */
  end(): void {
    this.ended = true;
    this.close();
  }
}
