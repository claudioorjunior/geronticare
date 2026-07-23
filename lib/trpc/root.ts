import { createTRPCRouter } from './server';
import { pacientesRouter } from './routers/pacientes';
import { instituicoesRouter } from './routers/instituicoes';
import { usuariosRouter } from './routers/usuarios';

export const appRouter = createTRPCRouter({
  pacientes: pacientesRouter,
  instituicoes: instituicoesRouter,
  usuarios: usuariosRouter,
});

export type AppRouter = typeof appRouter;
