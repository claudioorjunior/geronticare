import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { env } from '@/lib/env';
import { getDb } from '@/lib/db';
import {
  usuarios,
  sessions,
  accounts,
  verifications,
} from '@/lib/db/schema';

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
            user: usuarios,
            session: sessions,
            account: accounts,
            verification: verifications,
          },
        }),
        user: {
          modelName: 'user',
          fields: {
            name: 'nome',
            email: 'email',
            image: 'image',
          },
          additionalFields: {
            role: {
              type: 'string',
              required: false,
              defaultValue: 'profissional',
            },
          },
        },
        session: {
          modelName: 'session',
          fields: {
            expiresAt: 'expiresAt',
            token: 'token',
            ipAddress: 'ipAddress',
            userAgent: 'userAgent',
          },
          expiresIn: 60 * 60 * 24 * 7,
          updateAge: 60 * 60 * 24,
        },
        account: {
          modelName: 'account',
          fields: {
            accountId: 'accountId',
            providerId: 'providerId',
            accessToken: 'accessToken',
            refreshToken: 'refreshToken',
            idToken: 'idToken',
            accessTokenExpiresAt: 'accessTokenExpiresAt',
            refreshTokenExpiresAt: 'refreshTokenExpiresAt',
            scope: 'scope',
            password: 'password',
          },
        },
        verification: {
          modelName: 'verification',
          fields: {
            identifier: 'identifier',
            value: 'value',
            expiresAt: 'expiresAt',
          },
        },
        emailAndPassword: {
          enabled: true,
          requireEmailVerification: false,
        },
        advanced: {
          database: {
            // Colunas id são uuid() com defaultRandom no schema — o Better Auth
            // precisa gerar UUID, não strings aleatórias de 30 chars.
            generateId: 'uuid',
          },
        },
        secret: env.AUTH_SECRET,
        baseURL: env.AUTH_URL,
      } as const;
      return betterAuth(options as unknown as Parameters<typeof betterAuth>[0]);
    })();
  }
  _auth = await _authPromise;
  return _auth;
}

export { authClient } from './client';
