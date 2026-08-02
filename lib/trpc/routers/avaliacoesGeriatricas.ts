import { z } from 'zod';
import { createTRPCRouter, protectedProcedure, clinicalProcedure } from '../server';
import { avaliacoesGeriatricas, usuarios } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { calcularAgaScores, criarAvaliacaoSchema, interpretarEscala } from '@/lib/validations/escalas';
import { verificarOwnershipPaciente } from '../ownership';

export const avaliacoesGeriatricasRouter = createTRPCRouter({
  listar: protectedProcedure
    .input(z.object({ pacienteId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await verificarOwnershipPaciente(ctx.db, input.pacienteId, ctx.instituicaoId);

      return ctx.db.query.avaliacoesGeriatricas.findMany({
        where: eq(avaliacoesGeriatricas.pacienteId, input.pacienteId),
        orderBy: (avaliacoesGeriatricas, { desc }) => [desc(avaliacoesGeriatricas.dataAvaliacao)],
      });
    }),

  buscar: protectedProcedure
    .input(z.object({ id: z.string().uuid(), pacienteId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      // Ownership primeiro: mesmo erro (NOT_FOUND) para paciente inexistente
      // ou de outra instituição — não revela a existência do paciente.
      await verificarOwnershipPaciente(ctx.db, input.pacienteId, ctx.instituicaoId);

      // Consulta direta por id + pacienteId: id de outro paciente retorna
      // null, sem revelar que a avaliação existe em outro contexto.
      const avaliacao = await ctx.db.query.avaliacoesGeriatricas.findFirst({
        where: and(
          eq(avaliacoesGeriatricas.id, input.id),
          eq(avaliacoesGeriatricas.pacienteId, input.pacienteId),
        ),
      });

      if (!avaliacao) return null;

      const profissional = await ctx.db.query.usuarios.findFirst({
        where: eq(usuarios.id, avaliacao.profissionalId),
        columns: { nome: true, especialidade: true },
      });

      return {
        ...avaliacao,
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

  criar: clinicalProcedure
    .input(criarAvaliacaoSchema)
    .mutation(async ({ ctx, input }) => {
      await verificarOwnershipPaciente(ctx.db, input.pacienteId, ctx.instituicaoId);

      // Escores derivados EXCLUSIVAMENTE das respostas do formulário de
      // múltipla escolha — o servidor nunca aceita escores manuais.
      const scores = calcularAgaScores(input.respostas);

      const [novaAvaliacao] = await ctx.db
        .insert(avaliacoesGeriatricas)
        .values({
          pacienteId: input.pacienteId,
          dataAvaliacao: input.dataAvaliacao,
          ...scores,
          comorbidades: input.comorbidades,
          medicamentos: input.medicamentos,
          suporteSocial: input.suporteSocial,
          moradia: input.moradia,
          observacoes: input.observacoes,
          respostas: input.respostas,
          profissionalId: ctx.userId,
        })
        .returning();

      return novaAvaliacao;
    }),

  relatorio: protectedProcedure
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
