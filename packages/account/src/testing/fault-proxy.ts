type UrlFragment = string;

type Fault =
  | { readonly kind: 'drop'; readonly match: UrlFragment }
  | { readonly kind: 'throttle'; readonly match: UrlFragment; readonly retryAfter: string }
  | { readonly kind: 'server-fault'; readonly match: UrlFragment; readonly code: string }
  | { readonly kind: 'reject-token'; readonly match: UrlFragment }
  | { readonly kind: 'duplicate'; readonly match: UrlFragment }
  | { readonly kind: 'delay'; readonly match: UrlFragment; readonly arrived: () => void; readonly released: Promise<void> };

export interface HeldResponse {
  readonly arrived: Promise<void>;
  release(): void;
}

export class FaultProxy {
  requests = 0;
  readonly sent: { readonly url: string; readonly headers: Headers; readonly body: string | null; readonly bodyBytes: number }[] = [];
  onRequest: ((url: string) => void) | null = null;
  refuseLive = false;
  serverDown = false;
  private connected = true;
  private readonly faults: Fault[] = [];
  private readonly onlineListeners = new Set<(online: boolean) => void>();
  private readonly sockets = new Set<WebSocket>();

  constructor(private readonly upstream: typeof fetch = globalThis.fetch) {}

  get online(): boolean {
    return this.connected;
  }

  set online(online: boolean) {
    if (online === this.connected) return;
    this.connected = online;
    if (!online) for (const socket of this.sockets) socket.close();
    for (const listener of this.onlineListeners) listener(online);
  }

  onOnlineChange(listener: (online: boolean) => void): () => void {
    this.onlineListeners.add(listener);
    return () => this.onlineListeners.delete(listener);
  }

  get openSockets(): number {
    return [...this.sockets].filter((socket) => socket.readyState === WebSocket.OPEN).length;
  }

  readonly WebSocket: typeof WebSocket = proxiedWebSocket(
    () => this.connected && !this.refuseLive && !this.serverDown,
    (socket) => this.sockets.add(socket),
    (socket) => this.sockets.delete(socket),
  );

  dropNextResponse(match: UrlFragment = ''): void {
    this.faults.push({ kind: 'drop', match });
  }

  throttleNext(match: UrlFragment, retryAfter: string): void {
    this.faults.push({ kind: 'throttle', match, retryAfter });
  }

  serverFaultNext(match: UrlFragment, code: string): void {
    this.faults.push({ kind: 'server-fault', match, code });
  }

  rejectTokenNext(match: UrlFragment): void {
    this.faults.push({ kind: 'reject-token', match });
  }

  duplicateNextRequest(match: UrlFragment = ''): void {
    this.faults.push({ kind: 'duplicate', match });
  }

  delayNextResponse(match: UrlFragment = ''): HeldResponse {
    let arrived!: () => void;
    let release!: () => void;
    const arrival = new Promise<void>((resolve) => (arrived = resolve));
    const released = new Promise<void>((resolve) => (release = resolve));
    this.faults.push({ kind: 'delay', match, arrived, released });
    return { arrived: arrival, release };
  }

  readonly fetch: typeof fetch = async (input, givenInit) => {
    let init = givenInit;
    const url = input instanceof Request ? input.url : String(input);
    const text = typeof init?.body === 'string' ? init.body : null;
    this.sent.push({
      url,
      headers: new Headers(input instanceof Request ? input.headers : init?.headers),
      body: text,
      bodyBytes: text === null ? 0 : Buffer.byteLength(text, 'utf8'),
    });
    this.onRequest?.(url);
    if (!this.connected) throw new TypeError('Network request failed (offline)');
    if (this.serverDown) throw new TypeError('Network request failed (no response from the server)');
    const at = this.faults.findIndex((fault) => url.includes(fault.match));
    const fault = at < 0 ? undefined : this.faults.splice(at, 1)[0];
    if (fault?.kind === 'throttle') {
      return new Response(JSON.stringify({ message: 'rate limited' }), {
        status: 429,
        headers: { 'content-type': 'application/json', 'retry-after': fault.retryAfter },
      });
    }
    if (fault?.kind === 'server-fault') {
      return new Response(JSON.stringify({ code: fault.code, message: 'server fault', details: null, hint: null }), {
        status: 500,
        headers: { 'content-type': 'application/json' },
      });
    }
    if (fault?.kind === 'reject-token') {
      const headers = new Headers(input instanceof Request ? input.headers : init?.headers);
      headers.set('authorization', 'Bearer expired');
      init = { ...init, headers };
    }
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
      super(reachable() ? url : 'ws://127.0.0.1:9', protocols);
      opened(this);
      this.addEventListener('close', () => closed(this));
    }
  };
}
