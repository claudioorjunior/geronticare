'use client';

import { createAuthClient } from 'better-auth/react';

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL,
});

type LogoutDependencies = {
  signOut: () => Promise<unknown>;
  clearCache: () => void;
  redirect: () => void;
};

export async function logoutAndClearClientState({
  signOut,
  clearCache,
  redirect,
}: LogoutDependencies): Promise<void> {
  try {
    await signOut();
  } finally {
    clearCache();
    redirect();
  }
}
