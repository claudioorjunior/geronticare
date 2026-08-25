import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  client: { end: vi.fn() },
  db: { kind: 'postgres-db' },
  postgres: vi.fn(),
  drizzle: vi.fn(),
  migrate: vi.fn(),
}));

vi.mock('postgres', () => ({ default: mocks.postgres }));
vi.mock('drizzle-orm/postgres-js', () => ({ drizzle: mocks.drizzle }));
vi.mock('drizzle-orm/postgres-js/migrator', () => ({ migrate: mocks.migrate }));
vi.mock('@/lib/env', () => ({
  env: { DATABASE_URL: 'postgresql://user:password@localhost:5432/geronticare' },
}));

describe('getDb in production', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubEnv('NODE_ENV', 'production');
    mocks.postgres.mockReturnValue(mocks.client);
    mocks.drizzle.mockReturnValue(mocks.db);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('opens the database without running migrations', async () => {
    const { getDb } = await import('./index');

    await expect(getDb()).resolves.toBe(mocks.db);
    expect(mocks.postgres).toHaveBeenCalledWith(
      'postgresql://user:password@localhost:5432/geronticare',
      { prepare: false, max: 5, idle_timeout: 20 },
    );
    expect(mocks.migrate).not.toHaveBeenCalled();
  });
});
