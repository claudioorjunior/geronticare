export const DEFAULT_CALLBACK_URL = '/dashboard';

export function callbackUrlSeguro(
  value: string | null | undefined,
  origin: string,
): string {
  if (!value) return DEFAULT_CALLBACK_URL;

  try {
    const expectedOrigin = new URL(origin).origin;
    const resolved = new URL(value, expectedOrigin);
    if (resolved.origin !== expectedOrigin) return DEFAULT_CALLBACK_URL;

    return `${resolved.pathname}${resolved.search}${resolved.hash}`;
  } catch {
    return DEFAULT_CALLBACK_URL;
  }
}
