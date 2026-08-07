import { beforeEach, describe, expect, it, vi } from 'vitest';
import { parseUserInput, parseUserOutput } from 'better-auth/db';

const mocks = vi.hoisted(() => ({
  betterAuth: vi.fn((options: unknown) => options),
  drizzleAdapter: vi.fn(() => ({})),
  getDb: vi.fn(),
}));

vi.mock('better-auth', () => ({ betterAuth: mocks.betterAuth }));
vi.mock('better-auth/adapters/drizzle', () => ({ drizzleAdapter: mocks.drizzleAdapter }));
vi.mock('@/lib/db', () => ({ getDb: mocks.getDb }));
vi.mock('@/lib/env', () => ({
  env: {
    AUTH_SECRET: 'test-secret',
    AUTH_URL: 'http://localhost:3000',
  },
}));

describe('Better-Auth authorization fields', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mocks.getDb.mockResolvedValue({});
  });

  it('keeps role server-owned instead of accepting it as user input', async () => {
    const { getAuth } = await import('./index');

    await getAuth();

    const options = mocks.betterAuth.mock.calls[0]?.[0] as Parameters<typeof parseUserInput>[0];

    expect(options.user?.additionalFields?.role?.input).toBe(false);
    expect(() => parseUserInput(options, { role: 'admin' }, 'update')).toThrow(
      'role is not allowed to be set',
    );
    const storedUser = { id: 'user-id', role: 'profissional' } as unknown as Parameters<
      typeof parseUserOutput
    >[1];
    expect(parseUserOutput(options, storedUser)).toMatchObject(storedUser);
  });
});
