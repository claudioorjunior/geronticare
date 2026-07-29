import { initTRPC, TRPCError } from '@trpc/server';
import { getDb } from '@/lib/db';
import { getAuth } from '@/lib/auth';
import { usuarios } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import superjson from 'superjson';

const isDev = process.env.NODE_ENV === 'development';

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
    userId = session.user.id;
    const user = await db.query.usuarios.findFirst({
      where: eq(usuarios.id, session.user.id),
      columns: { instituicaoId: true, role: true },
    });
    instituicaoId = user?.instituicaoId ?? null;
    userRole = user?.role ?? null;
  } else if (
    // Dev-only bypass: requires BOTH NODE_ENV=development (which Next.js
    // replaces with "production" in prod builds, dead-coding this branch)
    // AND explicit override ids from .env.local (gitignored, never committed).
    // In production, without a valid session, the request fails isAuthed below.
    isDev &&
    process.env.DEV_OVERRIDE_USER_ID &&
    process.env.DEV_OVERRIDE_INSTITUICAO_ID
  ) {
    userId = process.env.DEV_OVERRIDE_USER_ID;
    instituicaoId = process.env.DEV_OVERRIDE_INSTITUICAO_ID;
    userRole = process.env.DEV_OVERRIDE_ROLE ?? 'admin';
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

type Context = Awaited<ReturnType<typeof createTRPCContext>>;

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

export const adminProcedure = t.procedure.use(isAuthed).use(({ ctx, next }) => {
  if (ctx.userRole !== 'admin') {
    throw new TRPCError({ code: 'FORBIDDEN' });
  }
  return next();
});

// Escrita e dados clínicos: só admin e profissional.
// Papel 'usuario' é somente leitura (listar/buscar pacientes, dashboard).
export const clinicalProcedure = t.procedure.use(isAuthed).use(({ ctx, next }) => {
  if (ctx.userRole !== 'admin' && ctx.userRole !== 'profissional') {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Seu perfil não tem permissão para esta ação',
    });
  }
  return next();
});
