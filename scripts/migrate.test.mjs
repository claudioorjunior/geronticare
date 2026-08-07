import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  drizzle: vi.fn(() => ({ db: true })),
  migrate: vi.fn(),
  postgres: vi.fn(),
}));

vi.mock('drizzle-orm/postgres-js', () => ({ drizzle: mocks.drizzle }));
vi.mock('drizzle-orm/postgres-js/migrator', () => ({ migrate: mocks.migrate }));
vi.mock('postgres', () => ({ default: mocks.postgres }));

import { runMigrations } from '@/scripts/migrate.mjs';

describe('production migration runner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.drizzle.mockReturnValue({ db: true });
  });

  it('runs repeatedly while holding a dedicated advisory lock', async () => {
    const events = [];
    const client = vi.fn(async (strings) => {
      events.push(String.raw({ raw: strings }));
    });
    client.reserve = vi.fn(() => {
      throw new Error('reserved connections are not Drizzle clients');
    });
    client.end = vi.fn();
    mocks.postgres.mockReturnValue(client);
    mocks.migrate.mockImplementation(async () => events.push('migrate'));

    await runMigrations('postgresql://test');
    await runMigrations('postgresql://test');

    expect(events).toEqual([
      'SELECT pg_advisory_lock()',
      'migrate',
      'SELECT pg_advisory_unlock()',
      'SELECT pg_advisory_lock()',
      'migrate',
      'SELECT pg_advisory_unlock()',
    ]);
    expect(client.reserve).not.toHaveBeenCalled();
    expect(mocks.drizzle).toHaveBeenNthCalledWith(1, client);
    expect(mocks.drizzle).toHaveBeenNthCalledWith(2, client);
    expect(client.end).toHaveBeenCalledTimes(2);
  });

  it('unlocks and closes the client when migration fails', async () => {
    const events = [];
    const client = vi.fn(async (strings) => {
      events.push(String.raw({ raw: strings }));
    });
    client.end = vi.fn();
    mocks.postgres.mockReturnValue(client);
    mocks.migrate.mockRejectedValueOnce(new Error('migration failed'));

    await expect(runMigrations('postgresql://test')).rejects.toThrow('migration failed');

    expect(events).toEqual([
      'SELECT pg_advisory_lock()',
      'SELECT pg_advisory_unlock()',
    ]);
    expect(client.end).toHaveBeenCalledOnce();
  });
});
