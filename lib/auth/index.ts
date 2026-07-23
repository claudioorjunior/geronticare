import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { db } from '@/lib/db';

export const auth = betterAuth({
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
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
  },
  secret: process.env.AUTH_SECRET!,
  baseURL: process.env.AUTH_URL!,
});
