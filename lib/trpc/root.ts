import { createTRPCRouter } from './server';
import { pacientesRouter } from './routers/pacientes';
import { instituicoesRouter } from './routers/instituicoes';
import { usuariosRouter } from './routers/usuarios';
import { avaliacoesGeriatricasRouter } from './routers/avaliacoesGeriatricas';
import { registrosRouter } from './routers/registros';
import { sinaisVitaisRouter } from './routers/sinaisVitais';

export const appRouter = createTRPCRouter({
  pacientes: pacientesRouter,
  instituicoes: instituicoesRouter,
  usuarios: usuariosRouter,
  avaliacoesGeriatricas: avaliacoesGeriatricasRouter,
  registros: registrosRouter,
  sinaisVitais: sinaisVitaisRouter,
});

export type AppRouter = typeof appRouter;
