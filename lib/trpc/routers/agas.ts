import { TRPCError } from '@trpc/server';
import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { agaAplicacoes, agas, aplicacoesInstrumentos, usuarios } from '@/lib/db/schema';
import type { Db } from '@/lib/db';
import { INSTRUMENTO_SLUGS } from '@/lib/instrumentos/instrumentos';
import { derivarGrauDependenciaRdc502 } from '@/lib/validations/escalas';
import { verificarOwnershipPaciente } from '../ownership';
import { clinicalProcedure, createTRPCRouter, readClinicalProcedure } from '../server';

const pacienteInput = z.strictObject({ pacienteId: z.string().uuid() });
const agaInput = z.strictObject({ agaId: z.string().uuid(), pacienteId: z.string().uuid() });
const concluirInput = agaInput.extend({
  grau: z.enum(['I', 'II', 'III']),
  justificativaGrau: z.string().trim().max(2000).optional(),
});
const applicationIds = z.array(z.string().uuid()).max(INSTRUMENTO_SLUGS.length);

type AgaContext = { db: Db; instituicaoId: string };

async function getAga(ctx: AgaContext, agaId: string, pacienteId: string) {
  await verificarOwnershipPaciente(ctx.db, pacienteId, ctx.instituicaoId);
  const aga = await ctx.db.query.agas.findFirst({
    where: and(eq(agas.id, agaId), eq(agas.pacienteId, pacienteId)),
  });
  if (!aga) throw new TRPCError({ code: 'NOT_FOUND', message: 'AGA não encontrada.' });
  return aga;
}

async function snapshotApplications(ctx: AgaContext, agaId: string, pacienteId: string, ids: string[], registradoPorId: string) {
  const applications = await ctx.db.query.aplicacoesInstrumentos.findMany({
    where: and(eq(aplicacoesInstrumentos.pacienteId, pacienteId), inArray(aplicacoesInstrumentos.id, ids)),
  });
  if (applications.length !== ids.length) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Uma ou mais aplicações não pertencem ao paciente ou à instituição.' });
  }
  const professionals = await ctx.db.query.usuarios.findMany({
    where: inArray(usuarios.id, applications.map((application) => application.profissionalId)),
    columns: { id: true, instituicaoId: true },
  });
  if (professionals.some((professional) => professional.instituicaoId !== ctx.instituicaoId) || professionals.length !== new Set(applications.map((application) => application.profissionalId)).size) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'A aplicação possui profissional de outra instituição.' });
  }
  const instruments = new Set<string>();
  for (const application of applications) {
    if (!INSTRUMENTO_SLUGS.includes(application.instrumento as (typeof INSTRUMENTO_SLUGS)[number])) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Instrumento inválido para consolidação.' });
    }
    if (instruments.has(application.instrumento)) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'A AGA não pode conter duas aplicações do mesmo instrumento.' });
    }
    instruments.add(application.instrumento);
  }
  await ctx.db.transaction(async (tx) => {
    await tx.insert(agaAplicacoes).values(applications.map((application) => ({
      agaId,
      aplicacaoInstrumentoId: application.id,
      instrumento: application.instrumento,
      profissionalId: application.profissionalId,
      registradoPorId,
      dataAplicacao: application.dataAplicacao,
      respostas: application.respostas,
      escore: application.escore,
      classificacao: application.classificacao,
      descricaoClassificacao: application.descricaoClassificacao,
      versaoInstrumento: application.versaoInstrumento,
    })));
  });
}

export const agasRouter = createTRPCRouter({
  aplicacoesDisponiveis: readClinicalProcedure.input(pacienteInput).query(async ({ ctx, input }) => {
    await verificarOwnershipPaciente(ctx.db, input.pacienteId, ctx.instituicaoId);
    return ctx.db.query.aplicacoesInstrumentos.findMany({
      where: eq(aplicacoesInstrumentos.pacienteId, input.pacienteId),
      orderBy: [desc(aplicacoesInstrumentos.dataAplicacao), desc(aplicacoesInstrumentos.createdAt)],
      columns: { id: true, instrumento: true, dataAplicacao: true, escore: true, classificacao: true, descricaoClassificacao: true, versaoInstrumento: true },
      with: { profissional: { columns: { id: true, nome: true, especialidade: true, registroProfissional: true } } },
    });
  }),

  criarRascunho: clinicalProcedure.input(z.strictObject({
    pacienteId: z.string().uuid(),
    dataAvaliacao: z.coerce.date().optional(),
    observacoes: z.string().max(5000).optional(),
  })).mutation(async ({ ctx, input }) => {
    await verificarOwnershipPaciente(ctx.db, input.pacienteId, ctx.instituicaoId);
    const [aga] = await ctx.db.insert(agas).values({
      pacienteId: input.pacienteId,
      criadoPorId: ctx.userId,
      dataAvaliacao: input.dataAvaliacao,
      observacoes: input.observacoes,
      status: 'rascunho',
    }).returning({ id: agas.id });
    return aga;
  }),

  selecionarAplicacoes: clinicalProcedure.input(agaInput.extend({ aplicacaoIds: applicationIds })).mutation(async ({ ctx, input }) => {
    const aga = await getAga(ctx, input.agaId, input.pacienteId);
    if (aga.status !== 'rascunho') throw new TRPCError({ code: 'BAD_REQUEST', message: 'AGA concluída não pode ser alterada.' });
    await snapshotApplications(ctx, input.agaId, input.pacienteId, input.aplicacaoIds, ctx.userId);
    return { agaId: input.agaId };
  }),

  concluir: clinicalProcedure.input(concluirInput).mutation(async ({ ctx, input }) => {
    const aga = await getAga(ctx, input.agaId, input.pacienteId);
    if (aga.status !== 'rascunho') throw new TRPCError({ code: 'BAD_REQUEST', message: 'AGA concluída é imutável.' });
    const selected = await ctx.db.query.agaAplicacoes.findMany({ where: eq(agaAplicacoes.agaId, input.agaId) });

    const katz = selected.find((application) => application.instrumento === 'katz');
    if (!katz) throw new TRPCError({ code: 'BAD_REQUEST', message: 'A conclusão exige uma aplicação Katz selecionada para derivar o grau de dependência (RDC 502/2021).' });
    const meem = selected.find((application) => application.instrumento === 'meem');
    const sugerido = derivarGrauDependenciaRdc502({
      katzScore: katz.escore,
      meemScore: meem?.escore ?? null,
    });
    if (!sugerido) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Não foi possível derivar o grau de dependência a partir das escalas selecionadas.' });

    const divergente = input.grau !== sugerido.grau;
    if (divergente && !input.justificativaGrau) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Informe a justificativa clínica ao divergir do grau sugerido pelas escalas.' });
    }

    const label = `Grau ${input.grau}` as 'Grau I' | 'Grau II' | 'Grau III';
    const descricao = [
      `RDC 502/2021 — grau confirmado: ${label}.`,
      `Derivado de: ${sugerido.fundamento}`,
      ...(input.justificativaGrau ? [`Justificativa clínica: ${input.justificativaGrau}`] : []),
    ].join('\n');

    const [completed] = await ctx.db.update(agas).set({
      status: 'concluida', resultado: label, classificacao: label,
      descricaoClassificacao: descricao, concluidaEm: new Date(), concluidaPorId: ctx.userId, updatedAt: new Date(),
    }).where(and(eq(agas.id, input.agaId), eq(agas.status, 'rascunho'))).returning({ id: agas.id });
    if (!completed) throw new TRPCError({ code: 'BAD_REQUEST', message: 'AGA não pôde ser concluída.' });
    return completed;
  }),

  listar: readClinicalProcedure.input(pacienteInput).query(async ({ ctx, input }) => {
    await verificarOwnershipPaciente(ctx.db, input.pacienteId, ctx.instituicaoId);
    return ctx.db.query.agas.findMany({
      where: eq(agas.pacienteId, input.pacienteId), orderBy: [desc(agas.dataAvaliacao), desc(agas.createdAt)],
      columns: { id: true, status: true, dataAvaliacao: true, resultado: true, classificacao: true, descricaoClassificacao: true, concluidaEm: true, createdAt: true, observacoes: true },
    });
  }),

  buscar: readClinicalProcedure.input(agaInput).query(async ({ ctx, input }) => {
    const aga = await getAga(ctx, input.agaId, input.pacienteId);
    const selected = await ctx.db.query.agaAplicacoes.findMany({
      where: eq(agaAplicacoes.agaId, aga.id), orderBy: [asc(agaAplicacoes.dataAplicacao), asc(agaAplicacoes.instrumento)],
      with: { profissional: { columns: { id: true, nome: true, especialidade: true, registroProfissional: true } }, registradoPor: { columns: { id: true, nome: true } } },
    });
    const concluidaPor = aga.concluidaPorId
      ? await ctx.db.query.usuarios.findFirst({
          where: eq(usuarios.id, aga.concluidaPorId),
          columns: { id: true, nome: true, especialidade: true, registroProfissional: true },
        })
      : null;
    return { ...aga, aplicacoes: selected, concluidaPor };
  }),
});

export const agasRouterForTests = agasRouter;
