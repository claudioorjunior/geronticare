export const PRIVATE_NO_STORE =
  'private, no-cache, no-store, max-age=0, must-revalidate';

export function withPrivateNoStore(response: Response): Response {
  try {
    response.headers.set('Cache-Control', PRIVATE_NO_STORE);
    return response;
  } catch {
    const headers = new Headers(response.headers);
    headers.set('Cache-Control', PRIVATE_NO_STORE);
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }
}
