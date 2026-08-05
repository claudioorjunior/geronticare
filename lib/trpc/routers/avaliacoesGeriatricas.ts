import { z } from 'zod';
import { createTRPCRouter, readClinicalProcedure } from '../server';
import { avaliacoesGeriatricas, usuarios } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { interpretarEscala } from '@/lib/validations/escalas';
import { verificarOwnershipPaciente } from '../ownership';

/**
 * LEGACY READ-ONLY (A6, 2026-08-04).
 * `avaliacoesGeriatricas` (AGA monolítica) não é mais gravado: o fluxo novo
 * é `aplicacoesInstrumentos` (escalas independentes) + `agas` (consolidação).
 * Estas procedures existem apenas para leitura de dados antigos.
 */
export const avaliacoesGeriatricasRouter = createTRPCRouter({
  listar: readClinicalProcedure
    .input(z.object({ pacienteId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await verificarOwnershipPaciente(ctx.db, input.pacienteId, ctx.instituicaoId);

      return ctx.db.query.avaliacoesGeriatricas.findMany({
        where: eq(avaliacoesGeriatricas.pacienteId, input.pacienteId),
        orderBy: (avaliacoesGeriatricas, { desc }) => [desc(avaliacoesGeriatricas.dataAvaliacao)],
        columns: {
          id: true,
          dataAvaliacao: true,
          katzScore: true,
          lawtonScore: true,
          meemScore: true,
          gds15Score: true,
          manScore: true,
          tugSegundos: true,
          rdc502Autocuidado: true,
          rdc502Cognicao: true,
          observacoes: true,
        },
      });
    }),

  buscar: readClinicalProcedure
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
        columns: {
          id: true,
          profissionalId: true,
          dataAvaliacao: true,
          katzScore: true,
          lawtonScore: true,
          meemScore: true,
          gds15Score: true,
          manScore: true,
          tugSegundos: true,
          rdc502Autocuidado: true,
          rdc502Cognicao: true,
          comorbidades: true,
          medicamentos: true,
          suporteSocial: true,
          moradia: true,
          observacoes: true,
        },
      });

      if (!avaliacao) return null;

      const profissional = await ctx.db.query.usuarios.findFirst({
        where: eq(usuarios.id, avaliacao.profissionalId),
        columns: { nome: true, especialidade: true },
      });

      return {
        id: avaliacao.id,
        dataAvaliacao: avaliacao.dataAvaliacao,
        katzScore: avaliacao.katzScore,
        lawtonScore: avaliacao.lawtonScore,
        meemScore: avaliacao.meemScore,
        gds15Score: avaliacao.gds15Score,
        manScore: avaliacao.manScore,
        tugSegundos: avaliacao.tugSegundos,
        rdc502Autocuidado: avaliacao.rdc502Autocuidado,
        rdc502Cognicao: avaliacao.rdc502Cognicao,
        observacoes: avaliacao.observacoes,
        comorbidades: avaliacao.comorbidades,
        medicamentos: avaliacao.medicamentos,
        suporteSocial: avaliacao.suporteSocial,
        moradia: avaliacao.moradia,
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

  relatorio: readClinicalProcedure
    .input(z.object({ pacienteId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await verificarOwnershipPaciente(ctx.db, input.pacienteId, ctx.instituicaoId);

      const avaliacao = await ctx.db.query.avaliacoesGeriatricas.findFirst({
        where: eq(avaliacoesGeriatricas.pacienteId, input.pacienteId),
        orderBy: (avaliacoesGeriatricas, { desc }) => [desc(avaliacoesGeriatricas.dataAvaliacao)],
        columns: {
          profissionalId: true,
          dataAvaliacao: true,
          katzScore: true,
          lawtonScore: true,
          meemScore: true,
          gds15Score: true,
          manScore: true,
          tugSegundos: true,
        },
      });

      if (!avaliacao) return null;

      const profissional = await ctx.db.query.usuarios.findFirst({
        where: eq(usuarios.id, avaliacao.profissionalId),
        columns: { nome: true, especialidade: true },
      });

      return {
        avaliacao: {
          dataAvaliacao: avaliacao.dataAvaliacao,
          katzScore: avaliacao.katzScore,
          lawtonScore: avaliacao.lawtonScore,
          meemScore: avaliacao.meemScore,
          gds15Score: avaliacao.gds15Score,
          manScore: avaliacao.manScore,
          tugSegundos: avaliacao.tugSegundos,
        },
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
