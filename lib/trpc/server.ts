import { initTRPC, TRPCError } from '@trpc/server';
import { getDb, type Db } from '@/lib/db';
import { getAuth } from '@/lib/auth';
import { usuarios } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import superjson from 'superjson';
import { podeLerClinico, podeAcessarClinico, podeAdministrar, devBypassAtivo } from './autorizacao';

/**
 * Bypass de autenticação para desenvolvimento local.
 * Exige NODE_ENV=development E DEV_AUTH_BYPASS=true — nunca ativa em produção,
 * mesmo que a variável seja setada por engano (fail-closed).
 */
const devAuthBypass = devBypassAtivo();

// Usuário admin do seed usado como padrão no bypass local.
const DEV_USER_ID = '320471aa-5994-4886-9ee6-1cee8e7aa810';

/** Resolve instituição e papel do usuário no banco (sessão real ou bypass). */
async function resolverUsuario(db: Db, userId: string) {
  return db.query.usuarios.findFirst({
    where: eq(usuarios.id, userId),
    columns: { instituicaoId: true, role: true, ativo: true },
  });
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

  if (session?.user?.id) {
    const user = await resolverUsuario(db, session.user.id);
    if (user?.ativo) {
      userId = session.user.id;
      instituicaoId = user.instituicaoId;
      userRole = user.role;
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
    }
  }

  return {
    db,
    session,
    userId,
    instituicaoId,
    userRole,
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
    },
  });
});

export const protectedProcedure = t.procedure.use(isAuthed);

export const readClinicalProcedure = t.procedure.use(isAuthed).use(({ ctx, next }) => {
  if (!podeLerClinico(ctx.userRole)) {
    throw new TRPCError({ code: 'FORBIDDEN' });
  }
  return next();
});

export const adminProcedure = t.procedure.use(isAuthed).use(({ ctx, next }) => {
  if (!podeAdministrar(ctx.userRole)) {
    throw new TRPCError({ code: 'FORBIDDEN' });
  }
  return next();
});

export const clinicalProcedure = t.procedure.use(isAuthed).use(({ ctx, next }) => {
  if (!podeAcessarClinico(ctx.userRole)) {
    throw new TRPCError({ code: 'FORBIDDEN' });
  }
  return next();
});
