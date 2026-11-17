// Spec 2 Timing; #50

export type LiveChannelStatus = 'joined' | 'closed';

export interface LiveChannel {
  join(handlers: {
    readonly hint: () => void;
    readonly holder: (claim: number) => void;
    readonly status: (status: LiveChannelStatus) => void;
  }): void;
  claim(): Promise<number>;
  leave(): void;
}

export class LiveUpdates {
  private channel: LiveChannel | null = null;
  private claim: number | null = null;
  private newest = 0;
  private joined = false;
  private ended = false;

  constructor(
    private readonly connect: () => LiveChannel,
    private readonly onHint: () => void,
  ) {}

  get live(): boolean {
    return this.channel !== null && this.joined && this.claim !== null;
  }

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
        if (this.claim !== null && claim > this.claim) this.close();
      },
      status: (status) => {
        if (this.channel !== channel) return;
        if (status === 'closed') return this.close();
        this.joined = true;
        channel.claim().then(
          (claim) => {
            if (this.channel !== channel) return;
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

  close(): void {
    const channel = this.channel;
    this.channel = null;
    this.claim = null;
    this.joined = false;
    channel?.leave();
  }

  renew(): void {
    if (!this.channel) return;
    this.close();
    this.start();
  }

  end(): void {
    this.ended = true;
    this.close();
  }
}
