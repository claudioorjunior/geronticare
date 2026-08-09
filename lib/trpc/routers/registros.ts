import { z } from 'zod';
import { createTRPCRouter, readClinicalProcedure, clinicalProcedure } from '../server';
import { registros, anexos, agas, sinaisVitais, usuarios } from '@/lib/db/schema';
import { eq, and, gte, lte, inArray } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { verificarOwnershipPaciente } from '../ownership';
import { urlHttpSchema } from '@/lib/validations/url';
import { storageConfigurado } from '@/lib/storage';
import { temPermissao } from '../autorizacao';

const anexoSchema = z.object({
  nome: z.string(),
  // SEGURANÇA: http/https apenas — `z.string().url()` aceita javascript:/file:
  url: urlHttpSchema.optional(),
  // Novos anexos clínicos persistem a chave privada e usam download-url para leitura.
  chave: z.string().min(1).max(1024).optional(),
  tipo: z.string(),
}).refine(
  ({ url, chave }) => (url !== undefined) !== (chave !== undefined),
  { message: 'Anexo deve informar URL legada ou chave privada, mas não ambas' },
);

// Anexo novo (tabela dedicada): chave + nome + tipo + tamanho.
const anexoNovoSchema = z.object({
  chave: z.string().min(1).max(1024),
  nome: z.string().min(1).max(255),
  tipo: z.string().min(1).max(255),
  tamanhoBytes: z.number().int().positive().max(50 * 1024 * 1024),
});

const MAX_ANEXOS_POR_REGISTRO = 50;

export const registrosRouter = createTRPCRouter({
  listar: readClinicalProcedure
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

      const registrosList = await ctx.db.query.registros.findMany({
        where: and(...condicoes),
        orderBy: (registros, { desc }) => [desc(registros.dataRegistro)],
        with: {
          anexos: {
            columns: { id: true, chave: true, nome: true, tipo: true, tamanhoBytes: true, createdAt: true },
          },
        },
      });

      return registrosList;
    }),

  buscar: readClinicalProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      // SEGURANÇA: mesmo comportamento para registro inexistente E para registro
      // de outra instituição (null) — evita oráculo de existência cross-tenant.
      // O findFirst SEM filtro de instituição é intencional: o ownership do
      // paciente é verificado depois; se o paciente não pertence à instituição,
      // retorna null igual a não-encontrado.
      const registro = await ctx.db.query.registros.findFirst({
        where: eq(registros.id, input.id),
        with: {
          anexos: {
            columns: { id: true, chave: true, nome: true, tipo: true, tamanhoBytes: true, createdAt: true },
          },
        },
      });

      if (!registro) return null;

      try {
        await verificarOwnershipPaciente(ctx.db, registro.pacienteId, ctx.instituicaoId);
      } catch (error) {
        if (error instanceof TRPCError && error.code === 'NOT_FOUND') return null;
        throw error;
      }

      return registro;
    }),

  criar: clinicalProcedure
    .input(
      z.object({
        pacienteId: z.string().uuid(),
        especialidade: z.enum(['medicina', 'enfermagem', 'fisioterapia', 'terapia_ocupacional', 'fonoaudiologia', 'nutricao', 'psicologia', 'servico_social']),
        tipo: z.enum(['evolucao', 'prescricao', 'exame', 'intercorrencia']),
        titulo: z.string().min(3),
        conteudo: z.string().min(1),
        dataRegistro: z.coerce.date().optional(),
        anexos: z.array(anexoSchema).optional(),
        // Anexos novos (tabela dedicada) — a chave é gerada pelo upload-url.
        anexosNovos: z.array(anexoNovoSchema).max(MAX_ANEXOS_POR_REGISTRO).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await verificarOwnershipPaciente(ctx.db, input.pacienteId, ctx.instituicaoId);

      const anexosNovos = input.anexosNovos ?? [];

      if (anexosNovos.length > 0 && !temPermissao(ctx.permissoes, 'anexo:criar')) {
        throw new TRPCError({ code: 'FORBIDDEN' });
      }

      // SEGURANÇA: não persiste metadados de anexo sem storage configurado —
      // evita "anexo fantasma" (metadado sem objeto) com chave forjada.
      if (anexosNovos.length > 0 && !storageConfigurado()) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Storage de anexos não configurado',
        });
      }

      // SEGURANÇA: cada chave de anexo novo precisa estar no formato gerado
      // pelo app e pertencer a este paciente/instituição.
      const { extrairContextoChaveAnexo } = await import('@/lib/storage/s3');
      for (const anexo of anexosNovos) {
        const contexto = extrairContextoChaveAnexo(anexo.chave);
        if (
          !contexto ||
          contexto.instituicaoId !== ctx.instituicaoId ||
          contexto.pacienteId !== input.pacienteId
        ) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Chave de anexo inválida para este paciente',
          });
        }
      }

      // Registro + metadados de anexos na mesma transação — falha reverte tudo.
      // ADR 0001: a mutation devolve só `{ id }` — nunca ecoa a linha.
      return ctx.db.transaction(async (tx) => {
        const [novoRegistro] = await tx
          .insert(registros)
          .values({
            ...input,
            profissionalId: ctx.userId,
          })
          .returning({ id: registros.id });

        if (anexosNovos.length > 0) {
          await tx.insert(anexos).values(
            anexosNovos.map((anexo) => ({
              instituicaoId: ctx.instituicaoId,
              pacienteId: input.pacienteId,
              registroId: novoRegistro.id,
              criadoPorId: ctx.userId,
              chave: anexo.chave,
              nome: anexo.nome,
              tipo: anexo.tipo,
              tamanhoBytes: anexo.tamanhoBytes,
            })),
          );
        }

        return novoRegistro;
      });
    }),

  timeline: readClinicalProcedure
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

      const condicoesAga = [
        eq(agas.pacienteId, pacienteId),
        eq(agas.status, 'concluida'),
      ];
      if (dataInicio) condicoesAga.push(gte(agas.dataAvaliacao, dataInicio));
      if (dataFim) condicoesAga.push(lte(agas.dataAvaliacao, dataFim));

      const condicoesSinais = [eq(sinaisVitais.pacienteId, pacienteId)];
      if (dataInicio) condicoesSinais.push(gte(sinaisVitais.dataAfericao, dataInicio));
      if (dataFim) condicoesSinais.push(lte(sinaisVitais.dataAfericao, dataFim));

      const [registrosList, agaList, sinaisList] = await Promise.all([
        ctx.db.query.registros.findMany({
          where: and(...condicoesRegistros),
          orderBy: (registros, { desc }) => [desc(registros.dataRegistro)],
          with: {
            anexos: {
              columns: { id: true, chave: true, nome: true, tipo: true, tamanhoBytes: true, createdAt: true },
            },
          },
        }),
        ctx.db.query.agas.findMany({
          where: and(...condicoesAga),
          orderBy: (agas, { desc }) => [desc(agas.dataAvaliacao)],
        }),
        ctx.db.query.sinaisVitais.findMany({
          where: and(...condicoesSinais),
          orderBy: (sinaisVitais, { desc }) => [desc(sinaisVitais.dataAfericao)],
        }),
      ]);

      // Busca nomes dos profissionais (uma query para todos)
      const profissionalIds = new Set([
        ...registrosList.map(r => r.profissionalId),
        ...agaList.flatMap((a) => a.concluidaPorId ? [a.concluidaPorId] : []),
        ...sinaisList.map(s => s.profissionalId),
      ]);

      const profissionais = profissionalIds.size > 0
        ? await ctx.db.query.usuarios.findMany({
            where: and(
              inArray(usuarios.id, Array.from(profissionalIds)),
              eq(usuarios.instituicaoId, ctx.instituicaoId),
            ),
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
          detalhes: { tipo: r.tipo, conteudo: r.conteudo, anexos: r.anexos },
        });
      }

      for (const a of agaList) {
        const prof = a.concluidaPorId ? profMap.get(a.concluidaPorId) : undefined;
        timeline.push({
          id: a.id,
          tipo: 'aga',
          data: a.dataAvaliacao,
          titulo: 'Avaliação Geriátrica Ampla',
          profissional: prof?.nome ?? 'Desconhecido',
          especialidade: prof?.especialidade ?? 'medicina',
          detalhes: {
            resultado: a.resultado,
            classificacao: a.classificacao,
            descricaoClassificacao: a.descricaoClassificacao,
            concluidaEm: a.concluidaEm,
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
});
