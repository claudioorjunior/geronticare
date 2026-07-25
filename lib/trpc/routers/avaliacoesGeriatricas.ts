import { z } from 'zod';
import { createTRPCRouter, clinicalProcedure } from '../server';
import { avaliacoesGeriatricas, usuarios } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { criarAvaliacaoSchema, interpretarEscala } from '@/lib/validations/escalas';
import { verificarOwnershipPaciente } from '../ownership';

export const avaliacoesGeriatricasRouter = createTRPCRouter({
  listar: clinicalProcedure
    .input(z.object({ pacienteId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await verificarOwnershipPaciente(ctx.db, input.pacienteId, ctx.instituicaoId);

      return ctx.db.query.avaliacoesGeriatricas.findMany({
        where: eq(avaliacoesGeriatricas.pacienteId, input.pacienteId),
        orderBy: (avaliacoesGeriatricas, { desc }) => [desc(avaliacoesGeriatricas.dataAvaliacao)],
      });
    }),

  buscar: clinicalProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const avaliacao = await ctx.db.query.avaliacoesGeriatricas.findFirst({
        where: eq(avaliacoesGeriatricas.id, input.id),
      });

      if (!avaliacao) return null;

      // Verifica ownership antes de retornar dados clínicos
      await verificarOwnershipPaciente(ctx.db, avaliacao.pacienteId, ctx.instituicaoId);

      return {
        ...avaliacao,
        interpretacao: {
          katz: interpretarEscala('katz', avaliacao.katzScore),
          lawton: interpretarEscala('lawton', avaliacao.lawtonScore),
          meem: interpretarEscala('meem', avaliacao.meemScore),
          gds15: interpretarEscala('gds15', avaliacao.gds15Score),
          man: interpretarEscala('man', avaliacao.manScore),
          tug: interpretarEscala('tug', avaliacao.tugSegundos),
        },
      };
    }),

  criar: clinicalProcedure
    .input(criarAvaliacaoSchema)
    .mutation(async ({ ctx, input }) => {
      await verificarOwnershipPaciente(ctx.db, input.pacienteId, ctx.instituicaoId);

      const [novaAvaliacao] = await ctx.db
        .insert(avaliacoesGeriatricas)
        .values({
          ...input,
          profissionalId: ctx.userId,
        })
        .returning();

      return novaAvaliacao;
    }),

  relatorio: clinicalProcedure
    .input(z.object({ pacienteId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await verificarOwnershipPaciente(ctx.db, input.pacienteId, ctx.instituicaoId);

      const avaliacao = await ctx.db.query.avaliacoesGeriatricas.findFirst({
        where: eq(avaliacoesGeriatricas.pacienteId, input.pacienteId),
        orderBy: (avaliacoesGeriatricas, { desc }) => [desc(avaliacoesGeriatricas.dataAvaliacao)],
      });

      if (!avaliacao) return null;

      const profissional = await ctx.db.query.usuarios.findFirst({
        where: eq(usuarios.id, avaliacao.profissionalId),
        columns: { nome: true, especialidade: true },
      });

      return {
        avaliacao,
        profissional: profissional?.nome,
        especialidade: profissional?.especialidade,
        interpretacao: {
          katz: interpretarEscala('katz', avaliacao.katzScore),
          lawton: interpretarEscala('lawton', avaliacao.lawtonScore),
          meem: interpretarEscala('meem', avaliacao.meemScore),
          gds15: interpretarEscala('gds15', avaliacao.gds15Score),
          man: interpretarEscala('man', avaliacao.manScore),
          tug: interpretarEscala('tug', avaliacao.tugSegundos),
        },
      };
    }),
});
