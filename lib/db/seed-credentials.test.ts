import { describe, expect, it } from 'vitest';
import { loadDevSeedUsers } from './seed-credentials';

const PASSWORDS: NodeJS.ProcessEnv = {
  SEED_DEV_USERS: 'true',
  NODE_ENV: 'development',
  SEED_ADMIN_PASSWORD: 'admin-password-123',
  SEED_PROFISSIONAL_PASSWORD: 'prof-password-123',
  SEED_LEITOR_PASSWORD: 'leitor-password-123',
};

describe('development seed credentials', () => {
  it('requires explicit opt-in', () => {
    expect(() => loadDevSeedUsers({ ...PASSWORDS, SEED_DEV_USERS: 'false' })).toThrow(
      'SEED_DEV_USERS=true',
    );
  });

  it('never runs in production', () => {
    expect(() => loadDevSeedUsers({ ...PASSWORDS, NODE_ENV: 'production' })).toThrow(
      'bloqueado em produção',
    );
  });

  it('requires passwords to be injected and returns them only in memory', () => {
    const users = loadDevSeedUsers(PASSWORDS);

    expect(users).toEqual([
      {
        email: 'admin@mock.ilpi',
        password: 'admin-password-123',
        name: 'Admin Mock',
        role: 'admin',
      },
      {
        email: 'profissional@mock.ilpi',
        password: 'prof-password-123',
        name: 'Dr. Mock',
        role: 'profissional',
      },
      {
        email: 'leitor@mock.ilpi',
        password: 'leitor-password-123',
        name: 'Leitor Mock',
        role: 'usuario',
      },
    ]);
  });
});
