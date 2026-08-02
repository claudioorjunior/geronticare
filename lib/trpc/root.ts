import { createTRPCRouter } from './server';
import { pacientesRouter } from './routers/pacientes';
import { instituicoesRouter } from './routers/instituicoes';
import { usuariosRouter } from './routers/usuarios';
import { avaliacoesGeriatricasRouter } from './routers/avaliacoesGeriatricas';
import { registrosRouter } from './routers/registros';
import { sinaisVitaisRouter } from './routers/sinaisVitais';
import { dashboardRouter } from './routers/dashboard';
import { aplicacoesInstrumentosRouter } from './routers/aplicacoesInstrumentos';

export const appRouter = createTRPCRouter({
  pacientes: pacientesRouter,
  instituicoes: instituicoesRouter,
  usuarios: usuariosRouter,
  avaliacoesGeriatricas: avaliacoesGeriatricasRouter,
  registros: registrosRouter,
  sinaisVitais: sinaisVitaisRouter,
  dashboard: dashboardRouter,
  aplicacoesInstrumentos: aplicacoesInstrumentosRouter,
});

export type AppRouter = typeof appRouter;
