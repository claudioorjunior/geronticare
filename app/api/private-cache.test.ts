import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  fetchRequestHandler: vi.fn(),
  getAuth: vi.fn(),
  authHandler: vi.fn(),
}));

vi.mock('@trpc/server/adapters/fetch', () => ({
  fetchRequestHandler: mocks.fetchRequestHandler,
}));
vi.mock('@/lib/trpc/root', () => ({ appRouter: {} }));
vi.mock('@/lib/trpc/server', () => ({ createTRPCContext: vi.fn() }));
vi.mock('@/lib/auth', () => ({ getAuth: mocks.getAuth }));

import { GET as trpcGet, POST as trpcPost } from './trpc/[trpc]/route';
import { GET as authGet, POST as authPost } from './auth/[...all]/route';

const PRIVATE_NO_STORE = 'private, no-cache, no-store, max-age=0, must-revalidate';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.fetchRequestHandler.mockResolvedValue(new Response('{}'));
  mocks.authHandler.mockResolvedValue(new Response('{}'));
  mocks.getAuth.mockResolvedValue({ handler: mocks.authHandler });
});

describe('cache HTTP de APIs autenticadas', () => {
  it.each([
    ['GET', trpcGet],
    ['POST', trpcPost],
  ])('tRPC %s impede armazenamento de dados privados', async (method, handler) => {
    const response = await handler(new Request('http://localhost/api/trpc/test', { method }));

    expect(response.headers.get('cache-control')).toBe(PRIVATE_NO_STORE);
  });

  it.each([
    ['GET', authGet],
    ['POST', authPost],
  ])('auth %s impede armazenamento de sessão', async (method, handler) => {
    const request = new Request('http://localhost/api/auth/session', { method }) as NextRequest;
    const response = await handler(request);

    expect(response.headers.get('cache-control')).toBe(PRIVATE_NO_STORE);
  });
});
