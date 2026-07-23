import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '../server';
import { avaliacoesGeriatricas, pacientes, usuarios } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { criarAvaliacaoSchema, interpretarEscala } from '@/lib/validations/escalas';

export const avaliacoesGeriatricasRouter = createTRPCRouter({
  listar: protectedProcedure
    .input(z.object({ pacienteId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.query.avaliacoesGeriatricas.findMany({
        where: and(
          eq(avaliacoesGeriatricas.pacienteId, input.pacienteId),
        ),
        orderBy: (avaliacoesGeriatricas, { desc }) => [desc(avaliacoesGeriatricas.dataAvaliacao)],
      });
    }),

  buscar: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const avaliacao = await ctx.db.query.avaliacoesGeriatricas.findFirst({
        where: eq(avaliacoesGeriatricas.id, input.id),
      });

      if (!avaliacao) return null;

      // Inclui interpretação automática das escalas
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

  criar: protectedProcedure
    .input(criarAvaliacaoSchema)
    .mutation(async ({ ctx, input }) => {
      // Valida que o paciente pertence à mesma instituição
      const paciente = await ctx.db.query.pacientes.findFirst({
        where: and(
          eq(pacientes.id, input.pacienteId),
          eq(pacientes.instituicaoId, ctx.instituicaoId!)
        ),
      });

      if (!paciente) {
        throw new Error('Paciente não encontrado');
      }

      const [novaAvaliacao] = await ctx.db
        .insert(avaliacoesGeriatricas)
        .values({
          ...input,
          profissionalId: ctx.userId!,
        })
        .returning();

      return novaAvaliacao;
    }),

  relatorio: protectedProcedure
    .input(z.object({ pacienteId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      // Busca a AGA mais recente
      const avaliacao = await ctx.db.query.avaliacoesGeriatricas.findFirst({
        where: eq(avaliacoesGeriatricas.pacienteId, input.pacienteId),
        orderBy: (avaliacoesGeriatricas, { desc }) => [desc(avaliacoesGeriatricas.dataAvaliacao)],
      });

      if (!avaliacao) return null;

      // Busca o profissional que aplicou
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
