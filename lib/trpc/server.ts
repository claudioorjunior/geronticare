import { initTRPC, TRPCError } from '@trpc/server';
import { getDb, type Db } from '@/lib/db';
import { getAuth } from '@/lib/auth';
import { usuarios } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import superjson from 'superjson';
import {
  permissaoEfetiva,
  temPermissao,
  devBypassAtivo,
} from './autorizacao';
import type { Permissao } from '@/lib/permissoes';

/**
 * Bypass de autenticação para desenvolvimento local.
 * Exige NODE_ENV=development E DEV_AUTH_BYPASS=true — nunca ativa em produção,
 * mesmo que a variável seja setada por engano (fail-closed).
 */
const devAuthBypass = devBypassAtivo();

// Usuário admin do seed usado como padrão no bypass local.
const DEV_USER_ID = '320471aa-5994-4886-9ee6-1cee8e7aa810';

/** Resolve instituição, papel e permissões do usuário no banco (sessão real ou bypass). */
async function resolverUsuario(db: Db, userId: string) {
  const user = await db.query.usuarios.findFirst({
    where: eq(usuarios.id, userId),
    columns: { instituicaoId: true, role: true, ativo: true },
    with: {
      cargo: {
        // SEGURANÇA: busca também `ativo` do cargo; cargo inativo NÃO concede
        // permissões (revogação imediata ao desativar). Sem isso, desativar
        // um cargo deixava quem o tinha com acesso por tempo indeterminado.
        columns: { permissoes: true, ativo: true },
      },
    },
  });
  if (!user) return null;
  return {
    ...user,
    // Cargo inativo é tratado como ausente: permissões efetivas caem para as
    // do papel (PERMISSOES_BASE), nunca as do cargo desativado.
    permissoes: permissaoEfetiva(user.role, user.cargo?.ativo ? user.cargo.permissoes : undefined),
  };
}

export const createTRPCContext = async (opts: { headers: Headers }) => {
  const db = await getDb();
  const auth = await getAuth();

  let session = null;
  try {
    session = await auth.api.getSession({
      headers: opts.headers,
    });
  } catch {
    session = null;
  }

  let instituicaoId: string | null = null;
  let userRole: string | null = null;
  let userId: string | null = null;
  let permissoes: Permissao[] = [];

  if (session?.user?.id) {
    const user = await resolverUsuario(db, session.user.id);
    if (user?.ativo) {
      userId = session.user.id;
      instituicaoId = user.instituicaoId;
      userRole = user.role;
      permissoes = user.permissoes;
    }
  } else if (devAuthBypass) {
    // Desenvolvimento: impersona um usuário do seed (ou DEV_OVERRIDE_USER_ID).
    // Sem sessão e sem bypass, o contexto fica sem usuário -> UNAUTHORIZED.
    // Usuário inexistente também falha fechado (sem instituição).
    const overrideUserId = process.env.DEV_OVERRIDE_USER_ID || DEV_USER_ID;
    const user = await resolverUsuario(db, overrideUserId);
    if (user?.ativo) {
      userId = overrideUserId;
      instituicaoId = user.instituicaoId;
      userRole = user.role;
      permissoes = user.permissoes;
    }
  }

  return {
    db,
    session,
    userId,
    instituicaoId,
    userRole,
    permissoes,
    ...opts,
  };
};

export type Context = Awaited<ReturnType<typeof createTRPCContext>>;

const t = initTRPC.context<Context>().create({
  transformer: superjson,
});

export const createTRPCRouter = t.router;
export const publicProcedure = t.procedure;

const isAuthed = t.middleware(({ ctx, next }) => {
  if (!ctx.userId || !ctx.instituicaoId) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }
  return next({
    ctx: {
      userId: ctx.userId,
      instituicaoId: ctx.instituicaoId,
      userRole: ctx.userRole,
      permissoes: ctx.permissoes,
    },
  });
});

export const protectedProcedure = t.procedure.use(isAuthed);

/**
 * Factory de gate por permissão (`modulo:acao`). Routers futuros de módulos
 * (financeiro, juridico, logistica) usam direto:
 *   `exigirPermissao('financeiro:editar')`
 * O catálogo de permissões é fechado em `lib/permissoes.ts` (fonte canônica).
 */
export function exigirPermissao(permissao: Permissao) {
  return t.procedure.use(isAuthed).use(({ ctx, next }) => {
    if (!temPermissao(ctx.permissoes, permissao)) {
      throw new TRPCError({ code: 'FORBIDDEN' });
    }
    return next();
  });
}

// Gates legadas (nomes históricos preservados para compatibilidade dos callers).
export const readClinicalProcedure = exigirPermissao('clinico:ler');

export const adminProcedure = exigirPermissao('admin:administrar');

export const clinicalProcedure = exigirPermissao('clinico:editar');
