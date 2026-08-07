import { createHash, timingSafeEqual } from 'node:crypto';
import type { Db } from '@/lib/db';
import { accounts, instalacao, instituicoes, usuarios } from '@/lib/db/schema';
import { hashPassword } from 'better-auth/crypto';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { authUrlValida } from '@/lib/env';

export const SETUP_TOKEN_COOKIE_NAME = 'geronticare.setup_token';

const SETUP_TOKEN_PLACEHOLDERS = new Set([
  'gere-um-token-aleatorio-de-uso-unico',
  'generate-a-random-one-time-token',
]);

export function setupTokenValido(
  recebido: string | undefined,
  agora = Date.now(),
): boolean {
  const esperado = process.env.SETUP_TOKEN;
  const expiraEm = process.env.SETUP_TOKEN_EXPIRES_AT;
  if (
    !esperado
    || Buffer.byteLength(esperado, 'utf8') < 32
    || SETUP_TOKEN_PLACEHOLDERS.has(esperado)
    || !expiraEm
  ) return false;

  const expiraEmMs = Date.parse(expiraEm);
  if (!Number.isFinite(expiraEmMs) || expiraEmMs <= agora || !recebido) {
    return false;
  }

  const esperadoHash = createHash('sha256').update(esperado).digest();
  const recebidoHash = createHash('sha256').update(recebido).digest();
  return timingSafeEqual(esperadoHash, recebidoHash);
}

export function setupHostValido(host: string | undefined): boolean {
  const authUrl = process.env.AUTH_URL;
  if (!authUrlValida(authUrl) || !authUrl || !host) return false;

  try {
    return new URL(authUrl).host === host;
  } catch {
    return false;
  }
}

export const bootstrapInputSchema = z.object({
  instituicao: z.object({
    nome: z.string().trim().min(2).max(200),
  }),
  admin: z.object({
    nome: z.string().trim().min(2).max(200),
    email: z.string().trim().email().max(320),
    senha: z.string().min(8).max(128),
  }),
});

export class BootstrapIndisponivelError extends Error {
  readonly code = 'BOOTSTRAP_INDISPONIVEL';

  constructor() {
    super('A configuração inicial não está disponível');
    this.name = 'BootstrapIndisponivelError';
  }
}

export type EstadoBootstrap =
  | { necessario: true; inconsistente?: false }
  | { necessario: false; inconsistente?: true };

function isUniqueViolation(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  if ('code' in error && error.code === '23505') return true;
  return 'cause' in error && isUniqueViolation(error.cause);
}

export async function obterEstadoBootstrap(db: Db): Promise<EstadoBootstrap> {
  const [instalacao, instituicao, usuario] = await Promise.all([
    db.query.instalacao.findFirst({ columns: { id: true } }),
    db.query.instituicoes.findFirst({ columns: { id: true } }),
    db.query.usuarios.findFirst({ columns: { id: true } }),
  ]);

  if (!instalacao && !instituicao && !usuario) {
    return { necessario: true };
  }

  // Instalações anteriores ao marker continuam válidas durante o upgrade.
  if (!instalacao && instituicao && usuario) {
    return { necessario: false };
  }

  if (!instituicao || !usuario) {
    return { necessario: false, inconsistente: true };
  }

  const admin = await db.query.usuarios.findFirst({
    where: eq(usuarios.role, 'admin'),
    columns: { id: true },
  });
  const conta = admin && await db.query.accounts.findFirst({
    where: and(
      eq(accounts.userId, admin.id),
      eq(accounts.providerId, 'credential'),
    ),
    columns: { id: true },
  });

  if (admin && conta) {
    return { necessario: false };
  }

  return { necessario: false, inconsistente: true };
}

export async function concluirBootstrap(
  db: Db,
  rawInput: unknown,
): Promise<{ instituicaoId: string; usuarioId: string }> {
  const input = bootstrapInputSchema.parse(rawInput);

  try {
    return await db.transaction(async (tx) => {
      await tx.insert(instalacao).values({ id: 'principal' });

      const [instituicaoExistente, usuarioExistente] = await Promise.all([
        tx.query.instituicoes.findFirst({ columns: { id: true } }),
        tx.query.usuarios.findFirst({ columns: { id: true } }),
      ]);
      if (instituicaoExistente || usuarioExistente) {
        throw new BootstrapIndisponivelError();
      }

      const [instituicao] = await tx
        .insert(instituicoes)
        .values({ nome: input.instituicao.nome })
        .returning({ id: instituicoes.id });

      const senhaHash = await hashPassword(input.admin.senha);
      const [admin] = await tx
        .insert(usuarios)
        .values({
          instituicaoId: instituicao.id,
          nome: input.admin.nome,
          email: input.admin.email.toLowerCase(),
          role: 'admin',
        })
        .returning({ id: usuarios.id });

      await tx.insert(accounts).values({
        userId: admin.id,
        accountId: admin.id,
        providerId: 'credential',
        password: senhaHash,
      });

      return {
        instituicaoId: instituicao.id,
        usuarioId: admin.id,
      };
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new BootstrapIndisponivelError();
    }
    throw error;
  }
}
