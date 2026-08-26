import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { proxy } from './proxy';

describe('bootstrap routes in proxy', () => {
  it.each(['/', '/setup'])('lets %s reach its server component without a session', (pathname) => {
    const response = proxy(new NextRequest(`http://localhost${pathname}`));

    expect(response.headers.get('x-middleware-next')).toBe('1');
    expect(response.headers.get('location')).toBeNull();
  });

  it('still redirects a protected page without a session', () => {
    const response = proxy(new NextRequest('http://localhost/dashboard'));

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe(
      'http://localhost/login?callbackUrl=%2Fdashboard',
    );
  });

  it('lets public brand assets load without a session', () => {
    const response = proxy(new NextRequest('http://localhost/geronticare-logo.png'));

    expect(response.headers.get('x-middleware-next')).toBe('1');
    expect(response.headers.get('location')).toBeNull();
  });
});
