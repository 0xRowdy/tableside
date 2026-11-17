// #106

const ALLOWED_HEADERS = 'authorization, apikey, content-type, x-client-info, x-tableside-environment';

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
