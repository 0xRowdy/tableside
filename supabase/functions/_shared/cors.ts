// Cross-origin access for the functions the web account page calls (#106):
// the page is served from its own origin, so the browser asks first
// (preflight) and reads an answer only when it allows that origin. Any origin
// may call: no request relies on cookies or the browser's own credentials,
// only on the bearer token or the publishable key a request carries, so a
// page elsewhere gains nothing it couldn't do with a plain HTTP client.

const ALLOWED_HEADERS = 'authorization, apikey, content-type, x-client-info, x-tableside-environment';

/** Answers a preflight, and lets the browser read every other answer. */
export function withCors(handler: (request: Request) => Promise<Response>): (request: Request) => Promise<Response> {
  return async (request) => {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'access-control-allow-origin': '*',
          'access-control-allow-methods': 'POST, OPTIONS',
          'access-control-allow-headers': ALLOWED_HEADERS,
          'access-control-max-age': '600',
        },
      });
    }
    const response = await handler(request);
    response.headers.set('access-control-allow-origin', '*');
    return response;
  };
}
