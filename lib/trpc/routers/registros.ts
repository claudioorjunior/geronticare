import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '../server';
import { registros, pacientes, avaliacoesGeriatricas, sinaisVitais } from '@/lib/db/schema';
import { eq, and, gte, lte } from 'drizzle-orm';

// Helper: valida que paciente pertence à mesma instituição
async function verificarOwnershipPaciente(
  db: typeof import('@/lib/db').db,
  pacienteId: string,
  instituicaoId: string
) {
  const paciente = await db.query.pacientes.findFirst({
    where: and(
      eq(pacientes.id, pacienteId),
      eq(pacientes.instituicaoId, instituicaoId)
    ),
  });
  if (!paciente) {
    throw new Error('Paciente não encontrado ou não pertence à sua instituição');
  }
  return paciente;
}

export const registrosRouter = createTRPCRouter({
  listar: protectedProcedure
    .input(
      z.object({
        pacienteId: z.string().uuid(),
        especialidade: z.enum(['medicina', 'enfermagem', 'fisioterapia', 'terapia_ocupacional', 'fonoaudiologia', 'nutricao', 'psicologia', 'servico_social']).optional(),
        tipo: z.enum(['evolucao', 'prescricao', 'exame', 'intercorrencia']).optional(),
        dataInicio: z.coerce.date().optional(),
        dataFim: z.coerce.date().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { pacienteId, especialidade, tipo, dataInicio, dataFim } = input;

      await verificarOwnershipPaciente(ctx.db, pacienteId, ctx.instituicaoId);

      const condicoes = [
        eq(registros.pacienteId, pacienteId),
      ];

      if (especialidade) condicoes.push(eq(registros.especialidade, especialidade));
      if (tipo) condicoes.push(eq(registros.tipo, tipo));
      if (dataInicio) condicoes.push(gte(registros.dataRegistro, dataInicio));
      if (dataFim) condicoes.push(lte(registros.dataRegistro, dataFim));

      return ctx.db.query.registros.findMany({
        where: and(...condicoes),
        orderBy: (registros, { desc }) => [desc(registros.dataRegistro)],
      });
    }),

  buscar: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const registro = await ctx.db.query.registros.findFirst({
        where: eq(registros.id, input.id),
      });

      if (!registro) return null;

      await verificarOwnershipPaciente(ctx.db, registro.pacienteId, ctx.instituicaoId);

      return registro;
    }),

  criar: protectedProcedure
    .input(
      z.object({
        pacienteId: z.string().uuid(),
        especialidade: z.enum(['medicina', 'enfermagem', 'fisioterapia', 'terapia_ocupacional', 'fonoaudiologia', 'nutricao', 'psicologia', 'servico_social']),
        tipo: z.enum(['evolucao', 'prescricao', 'exame', 'intercorrencia']),
        titulo: z.string().min(3),
        conteudo: z.string().min(1),
        dataRegistro: z.coerce.date().optional(),
        anexos: z.array(
          z.object({
            nome: z.string(),
            url: z.string().url(),
            tipo: z.string(),
          })
        ).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await verificarOwnershipPaciente(ctx.db, input.pacienteId, ctx.instituicaoId);

      const [novoRegistro] = await ctx.db
        .insert(registros)
        .values({
          ...input,
          profissionalId: ctx.userId,
        })
        .returning();

      return novoRegistro;
    }),

  timeline: protectedProcedure
    .input(
      z.object({
        pacienteId: z.string().uuid(),
        dataInicio: z.coerce.date().optional(),
        dataFim: z.coerce.date().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { pacienteId, dataInicio, dataFim } = input;

      await verificarOwnershipPaciente(ctx.db, pacienteId, ctx.instituicaoId);

      // Busca registros, AGAs e sinais vitais do paciente em paralelo
      const condicoesRegistros = [eq(registros.pacienteId, pacienteId)];
      if (dataInicio) condicoesRegistros.push(gte(registros.dataRegistro, dataInicio));
      if (dataFim) condicoesRegistros.push(lte(registros.dataRegistro, dataFim));

      const condicoesAga = [eq(avaliacoesGeriatricas.pacienteId, pacienteId)];
      if (dataInicio) condicoesAga.push(gte(avaliacoesGeriatricas.dataAvaliacao, dataInicio));
      if (dataFim) condicoesAga.push(lte(avaliacoesGeriatricas.dataAvaliacao, dataFim));

      const condicoesSinais = [eq(sinaisVitais.pacienteId, pacienteId)];
      if (dataInicio) condicoesSinais.push(gte(sinaisVitais.dataAfericao, dataInicio));
      if (dataFim) condicoesSinais.push(lte(sinaisVitais.dataAfericao, dataFim));

      const [registrosList, agaList, sinaisList] = await Promise.all([
        ctx.db.query.registros.findMany({
          where: and(...condicoesRegistros),
          orderBy: (registros, { desc }) => [desc(registros.dataRegistro)],
        }),
        ctx.db.query.avaliacoesGeriatricas.findMany({
          where: and(...condicoesAga),
          orderBy: (avaliacoesGeriatricas, { desc }) => [desc(avaliacoesGeriatricas.dataAvaliacao)],
        }),
        ctx.db.query.sinaisVitais.findMany({
          where: and(...condicoesSinais),
          orderBy: (sinaisVitais, { desc }) => [desc(sinaisVitais.dataAfericao)],
        }),
      ]);

      // Busca nomes dos profissionais (uma query para todos)
      const profissionalIds = new Set([
        ...registrosList.map(r => r.profissionalId),
        ...agaList.map(a => a.profissionalId),
        ...sinaisList.map(s => s.profissionalId),
      ]);

      const profissionais = profissionalIds.size > 0
        ? await ctx.db.query.usuarios.findMany({
            where: (usuarios, { inArray }) => inArray(usuarios.id, Array.from(profissionalIds)),
            columns: { id: true, nome: true, especialidade: true },
          })
        : [];

      const profMap = new Map(profissionais.map(p => [p.id, p]));

      // Monta timeline unificada
      const timeline: Array<{
        id: string;
        tipo: 'registro' | 'aga' | 'sinal';
        data: Date;
        titulo: string;
        profissional: string;
        especialidade: string;
        detalhes?: Record<string, unknown>;
      }> = [];

      for (const r of registrosList) {
        const prof = profMap.get(r.profissionalId);
        timeline.push({
          id: r.id,
          tipo: 'registro',
          data: r.dataRegistro,
          titulo: r.titulo,
          profissional: prof?.nome ?? 'Desconhecido',
          especialidade: prof?.especialidade ?? r.especialidade,
          detalhes: { tipo: r.tipo, conteudo: r.conteudo },
        });
      }

      for (const a of agaList) {
        const prof = profMap.get(a.profissionalId);
        timeline.push({
          id: a.id,
          tipo: 'aga',
          data: a.dataAvaliacao,
          titulo: 'Avaliação Geriátrica Ampla',
          profissional: prof?.nome ?? 'Desconhecido',
          especialidade: prof?.especialidade ?? 'medicina',
          detalhes: {
            katzScore: a.katzScore,
            lawtonScore: a.lawtonScore,
            meemScore: a.meemScore,
            gds15Score: a.gds15Score,
            manScore: a.manScore,
            tugSegundos: a.tugSegundos,
          },
        });
      }

      for (const s of sinaisList) {
        const prof = profMap.get(s.profissionalId);
        timeline.push({
          id: s.id,
          tipo: 'sinal',
          data: s.dataAfericao,
          titulo: 'Sinais Vitais',
          profissional: prof?.nome ?? 'Desconhecido',
          especialidade: prof?.especialidade ?? 'enfermagem',
          detalhes: {
            pressaoArterialSistolica: s.pressaoArterialSistolica,
            pressaoArterialDiastolica: s.pressaoArterialDiastolica,
            frequenciaCardiaca: s.frequenciaCardiaca,
            temperatura: s.temperatura,
            saturacaoO2: s.saturacaoO2,
          },
        });
      }

      timeline.sort((a, b) => b.data.getTime() - a.data.getTime());

      return timeline;
    }),

  anexar: protectedProcedure
    .input(
      z.object({
        registroId: z.string().uuid(),
        anexos: z.array(
          z.object({
            nome: z.string(),
            url: z.string().url(),
            tipo: z.string(),
          })
        ),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const registro = await ctx.db.query.registros.findFirst({
        where: eq(registros.id, input.registroId),
      });

      if (!registro) {
        throw new Error('Registro não encontrado');
      }

      await verificarOwnershipPaciente(ctx.db, registro.pacienteId, ctx.instituicaoId);

      const anexosAtuais = registro.anexos ?? [];
      const novosAnexos = [...anexosAtuais, ...input.anexos];

      const [atualizado] = await ctx.db
        .update(registros)
        .set({ anexos: novosAnexos })
        .where(eq(registros.id, input.registroId))
        .returning();

      return atualizado;
    }),
});
