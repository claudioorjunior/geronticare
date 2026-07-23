import { createTRPCRouter } from './server';
import { pacientesRouter } from './routers/pacientes';

export const appRouter = createTRPCRouter({
  pacientes: pacientesRouter,
});

export type AppRouter = typeof appRouter;
