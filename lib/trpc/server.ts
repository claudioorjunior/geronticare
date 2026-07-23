import { initTRPC, TRPCError } from '@trpc/server';
import { db } from '@/lib/db';
import superjson from 'superjson';

export const createTRPCContext = async (opts: { headers: Headers }) => {
  return {
    db,
    ...opts,
  };
};

const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
});

export const createTRPCRouter = t.router;
export const publicProcedure = t.procedure;

// Middleware de autenticação (simplificado - expandir depois)
const isAuthenticated = t.middleware(({ ctx, next }) => {
  // TODO: implementar validação de sessão
  return next({
    ctx: {
      ...ctx,
      userId: 'temp-user-id', // placeholder
    },
  });
});

export const protectedProcedure = t.procedure.use(isAuthenticated);
