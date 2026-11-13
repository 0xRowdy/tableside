// The fault-injection proxy between a simulated device and the stack. It is
// the device's whole network: connectivity, dropped, delayed and duplicated
// exchanges, and refused live connections are injected here, never by
// stubbing the Account service.

/** Text a request's URL contains, such as a path. */
type UrlFragment = string;

type Fault =
  | { readonly kind: 'drop'; readonly match: UrlFragment }
  | { readonly kind: 'duplicate'; readonly match: UrlFragment }
  | { readonly kind: 'delay'; readonly match: UrlFragment; readonly arrived: () => void; readonly released: Promise<void> };

export interface HeldResponse {
  /** Resolves once the stack has answered and the response is being held. */
  readonly arrived: Promise<void>;
  /** Delivers the held response to the device. */
  release(): void;
}

export class FaultProxy {
  /** Requests that reached the stack (a duplicated request counts twice). */
  requests = 0;
  /** While true, live (WebSocket) connections are refused, as at a capacity limit. */
  refuseLive = false;
  private connected = true;
  private readonly faults: Fault[] = [];
  private readonly onlineListeners = new Set<(online: boolean) => void>();
  private readonly sockets = new Set<WebSocket>();

  constructor(private readonly upstream: typeof fetch = globalThis.fetch) {}

  /** While false, every request fails before reaching the stack and live connections drop. */
  get online(): boolean {
    return this.connected;
  }

  set online(online: boolean) {
    if (online === this.connected) return;
    this.connected = online;
    if (!online) for (const socket of this.sockets) socket.close();
    for (const listener of this.onlineListeners) listener(online);
  }

  /** The device's connectivity, as the operating system reports it. Returns an unsubscribe function. */
  onOnlineChange(listener: (online: boolean) => void): () => void {
    this.onlineListeners.add(listener);
    return () => this.onlineListeners.delete(listener);
  }

  /** Live connections open now. */
  get openSockets(): number {
    return [...this.sockets].filter((socket) => socket.readyState === WebSocket.OPEN).length;
  }

  /** The device's WebSocket: offline or refused, it connects nowhere. */
  readonly WebSocket: typeof WebSocket = proxiedWebSocket(
    () => this.connected && !this.refuseLive,
    (socket) => this.sockets.add(socket),
    (socket) => this.sockets.delete(socket),
  );

  /** The next matching request reaches the stack, but its response is lost. */
  dropNextResponse(match: UrlFragment = ''): void {
    this.faults.push({ kind: 'drop', match });
  }

  /** The next matching request reaches the stack twice; the device gets the first response. */
  duplicateNextRequest(match: UrlFragment = ''): void {
    this.faults.push({ kind: 'duplicate', match });
  }

  /** The next matching response is held until released. */
  delayNextResponse(match: UrlFragment = ''): HeldResponse {
    let arrived!: () => void;
    let release!: () => void;
    const arrival = new Promise<void>((resolve) => (arrived = resolve));
    const released = new Promise<void>((resolve) => (release = resolve));
    this.faults.push({ kind: 'delay', match, arrived, released });
    return { arrived: arrival, release };
  }

  readonly fetch: typeof fetch = async (input, init) => {
    if (!this.connected) throw new TypeError('Network request failed (offline)');
    const url = input instanceof Request ? input.url : String(input);
    const at = this.faults.findIndex((fault) => url.includes(fault.match));
    const fault = at < 0 ? undefined : this.faults.splice(at, 1)[0];
    // A body can be read once; keep it so a duplicate can resend it.
    const body = init?.body;
    this.requests += 1;
    const response = await this.upstream(input, init);
    switch (fault?.kind) {
      case 'drop':
        await response.arrayBuffer();
        throw new TypeError('Network request failed (response lost)');
      case 'duplicate':
        this.requests += 1;
        await (await this.upstream(input, { ...init, body: body ?? null })).arrayBuffer();
        return response;
      case 'delay':
        fault.arrived();
        await fault.released;
        return response;
      default:
        return response;
    }
  };
}

function proxiedWebSocket(reachable: () => boolean, opened: (socket: WebSocket) => void, closed: (socket: WebSocket) => void): typeof WebSocket {
  return class ProxiedWebSocket extends WebSocket {
    constructor(url: string | URL, protocols?: string | string[]) {
      // Port 9 (discard) refuses the connection at once.
      super(reachable() ? url : 'ws://127.0.0.1:9', protocols);
      opened(this);
      this.addEventListener('close', () => closed(this));
    }
  };
}
