import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { env } from '@/lib/env';
import { getDb } from '@/lib/db';

let _auth: ReturnType<typeof betterAuth> | null = null;
let _authPromise: Promise<ReturnType<typeof betterAuth>> | null = null;

export async function getAuth(): Promise<ReturnType<typeof betterAuth>> {
  if (_auth) return _auth;
  if (!_authPromise) {
    _authPromise = (async () => {
      const db = await getDb();
      const options = {
        database: drizzleAdapter(db, {
          provider: 'pg',
          schema: {
            user: {
              tableName: 'usuarios',
              fields: {
                id: 'id',
                email: 'email',
                name: 'nome',
                image: undefined,
                createdAt: 'createdAt',
                updatedAt: 'updatedAt',
              },
            },
            session: {
              tableName: 'sessions',
              fields: {
                id: 'id',
                userId: 'userId',
                expiresAt: 'expiresAt',
                token: 'token',
                createdAt: 'createdAt',
                updatedAt: 'updatedAt',
                ipAddress: 'ipAddress',
                userAgent: 'userAgent',
              },
            },
            account: {
              tableName: 'accounts',
              fields: {
                id: 'id',
                userId: 'userId',
                accountId: 'accountId',
                providerId: 'providerId',
                accessToken: 'accessToken',
                refreshToken: 'refreshToken',
                idToken: 'idToken',
                accessTokenExpiresAt: 'accessTokenExpiresAt',
                refreshTokenExpiresAt: 'refreshTokenExpiresAt',
                scope: 'scope',
                password: 'password',
                createdAt: 'createdAt',
                updatedAt: 'updatedAt',
              },
            },
            verification: {
              tableName: 'verifications',
              fields: {
                id: 'id',
                identifier: 'identifier',
                value: 'value',
                expiresAt: 'expiresAt',
                createdAt: 'createdAt',
                updatedAt: 'updatedAt',
              },
            },
          },
        }),
        emailAndPassword: {
          enabled: true,
          requireEmailVerification: false,
        },
        session: {
          expiresIn: 60 * 60 * 24 * 7,
          updateAge: 60 * 60 * 24,
        },
        secret: env.AUTH_SECRET,
        baseURL: env.AUTH_URL,
      } as const;
      return betterAuth(options as any);
    })();
  }
  _auth = await _authPromise;
  return _auth;
}

export { authClient } from './client';
