// The fault-injection proxy between a simulated device and the stack. It is
// the device's whole network: connectivity, dropped, delayed and duplicated
// exchanges are injected here, never by stubbing the Account service.

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
  /** While false, every request fails before reaching the stack. */
  online = true;
  /** Requests that reached the stack (a duplicated request counts twice). */
  requests = 0;
  private readonly faults: Fault[] = [];

  constructor(private readonly upstream: typeof fetch = globalThis.fetch) {}

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
    if (!this.online) throw new TypeError('Network request failed (offline)');
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
