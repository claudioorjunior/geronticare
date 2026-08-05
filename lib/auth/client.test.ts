import { describe, expect, it, vi } from 'vitest';

vi.mock('better-auth/react', () => ({
  createAuthClient: () => ({ signOut: vi.fn() }),
}));

import * as authClientModule from './client';

type LogoutAndClearClientState = (dependencies: {
  signOut: () => Promise<unknown>;
  clearCache: () => void;
  redirect: () => void;
}) => Promise<void>;

function getLogoutFunction(): LogoutAndClearClientState | undefined {
  return (authClientModule as typeof authClientModule & {
    logoutAndClearClientState?: LogoutAndClearClientState;
  }).logoutAndClearClientState;
}

describe('logoutAndClearClientState', () => {
  it('limpa o cache privado e redireciona depois do logout', async () => {
    const logout = getLogoutFunction();
    expect(logout).toBeTypeOf('function');
    if (!logout) return;

    const clearCache = vi.fn();
    const redirect = vi.fn();
    await logout({
      signOut: vi.fn().mockResolvedValue(undefined),
      clearCache,
      redirect,
    });

    expect(clearCache).toHaveBeenCalledOnce();
    expect(redirect).toHaveBeenCalledOnce();
  });

  it('limpa o cache e redireciona mesmo quando o logout remoto falha', async () => {
    const logout = getLogoutFunction();
    expect(logout).toBeTypeOf('function');
    if (!logout) return;

    const clearCache = vi.fn();
    const redirect = vi.fn();
    const error = new Error('falha de rede');

    await expect(logout({
      signOut: vi.fn().mockRejectedValue(error),
      clearCache,
      redirect,
    })).rejects.toBe(error);
    expect(clearCache).toHaveBeenCalledOnce();
    expect(redirect).toHaveBeenCalledOnce();
  });
});
