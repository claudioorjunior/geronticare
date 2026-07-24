import { initTRPC, TRPCError } from '@trpc/server';
import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import { usuarios } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import superjson from 'superjson';

export const createTRPCContext = async (opts: { headers: Headers }) => {
  let session = null;
  try {
    session = await auth.api.getSession({
      headers: opts.headers,
    });
  } catch {
    // Erro de autenticação não deve derrubar toda request
    session = null;
  }

  // Busca instituicaoId E role no DB
  let instituicaoId: string | null = null;
  let userRole: string | null = null;
  if (session?.user?.id) {
    const user = await db.query.usuarios.findFirst({
      where: eq(usuarios.id, session.user.id),
      columns: { instituicaoId: true, role: true },
    });
    instituicaoId = user?.instituicaoId ?? null;
    userRole = user?.role ?? null;
  }

  return {
    db,
    session,
    userId: session?.user?.id,
    instituicaoId,
    userRole,
    ...opts,
  };
};

const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
});

export const createTRPCRouter = t.router;
export const publicProcedure = t.procedure;

// Middleware de autenticação — exige userId E instituicaoId
const isAuthenticated = t.middleware(({ ctx, next }) => {
  if (!ctx.userId) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }
  if (!ctx.instituicaoId) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Usuário não está vinculado a uma instituição',
    });
  }
  return next({
    ctx: {
      ...ctx,
      userId: ctx.userId,
      instituicaoId: ctx.instituicaoId,
    },
  });
});

export const protectedProcedure = t.procedure.use(isAuthenticated);

// Só admin (gestão de instituição/usuários)
export const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.userRole !== 'admin') {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Requer papel admin' });
  }
  return next({ ctx: { ...ctx, userRole: ctx.userRole } });
});

// Profissional + admin (dados clínicos completos)
export const clinicalProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (!['admin', 'profissional'].includes(ctx.userRole ?? '')) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Requer papel profissional ou admin' });
  }
  return next({ ctx: { ...ctx, userRole: ctx.userRole } });
});
