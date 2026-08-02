import { createTRPCRouter, readClinicalProcedure } from '../server';
import {
  pacientes,
  avaliacoesGeriatricas,
  registros,
  sinaisVitais,
} from '@/lib/db/schema';
import { count, eq, and, desc, asc, gte, sql } from 'drizzle-orm';

export const dashboardRouter = createTRPCRouter({
  // Resumo do dashboard — contagens agregadas + pacientes recentes
  resumo: readClinicalProcedure.query(async ({ ctx }) => {
    const [totalRow] = await ctx.db
      .select({ value: count() })
      .from(pacientes)
      .where(
        and(eq(pacientes.instituicaoId, ctx.instituicaoId), eq(pacientes.ativo, true))
      );

    const seteDias = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const [admissoesRow] = await ctx.db
      .select({ value: count() })
      .from(pacientes)
      .where(
        and(
          eq(pacientes.instituicaoId, ctx.instituicaoId),
          eq(pacientes.ativo, true),
          gte(pacientes.createdAt, seteDias)
        )
      );

    // Pacientes ativos sem nenhuma AGA associada
    const [pendentesRow] = await ctx.db
      .select({ value: count() })
      .from(pacientes)
      .where(
        and(
          eq(pacientes.instituicaoId, ctx.instituicaoId),
          eq(pacientes.ativo, true),
          sql`NOT EXISTS (SELECT 1 FROM avaliacoes_geriatricas ag WHERE ag.paciente_id = ${pacientes.id})`
        )
      );

    const pacientesRecentes = await ctx.db.query.pacientes.findMany({
      where: and(eq(pacientes.instituicaoId, ctx.instituicaoId), eq(pacientes.ativo, true)),
      orderBy: desc(pacientes.createdAt),
      limit: 5,
    });

    return {
      totalPacientes: Number(totalRow?.value ?? 0),
      admissoesSemanais: Number(admissoesRow?.value ?? 0),
      agasPendentes: Number(pendentesRow?.value ?? 0),
      pacientesRecentes,
    };
  }),

  // Registros clínicos do dia atual (filtrados pela instituição)
  registrosHoje: readClinicalProcedure.query(async ({ ctx }) => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    return ctx.db
      .select({
        id: registros.id,
        pacienteId: registros.pacienteId,
        pacienteNome: pacientes.nome,
        profissionalId: registros.profissionalId,
        especialidade: registros.especialidade,
        tipo: registros.tipo,
        titulo: registros.titulo,
        conteudo: registros.conteudo,
        dataRegistro: registros.dataRegistro,
        anexos: registros.anexos,
        createdAt: registros.createdAt,
        updatedAt: registros.updatedAt,
      })
      .from(registros)
      .innerJoin(pacientes, eq(registros.pacienteId, pacientes.id))
      .where(
        and(eq(pacientes.instituicaoId, ctx.instituicaoId), gte(registros.dataRegistro, hoje))
      )
      .orderBy(desc(registros.dataRegistro))
      .limit(10);
  }),

  // Último sinal vital de cada paciente ativo da instituição
  // ponytail: subquery IN com (pacienteId, MAX(dataAfericao)); trocar por DISTINCT ON se perfilar lentidão
  ultimosSinaisVitais: readClinicalProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select({
        id: sinaisVitais.id,
        pacienteId: sinaisVitais.pacienteId,
        profissionalId: sinaisVitais.profissionalId,
        dataAfericao: sinaisVitais.dataAfericao,
        pressaoArterialSistolica: sinaisVitais.pressaoArterialSistolica,
        pressaoArterialDiastolica: sinaisVitais.pressaoArterialDiastolica,
        frequenciaCardiaca: sinaisVitais.frequenciaCardiaca,
        frequenciaRespiratoria: sinaisVitais.frequenciaRespiratoria,
        temperatura: sinaisVitais.temperatura,
        saturacaoO2: sinaisVitais.saturacaoO2,
        glicemia: sinaisVitais.glicemia,
        peso: sinaisVitais.peso,
        altura: sinaisVitais.altura,
        observacoes: sinaisVitais.observacoes,
        createdAt: sinaisVitais.createdAt,
        pacienteNome: pacientes.nome,
      })
      .from(sinaisVitais)
      .innerJoin(pacientes, eq(sinaisVitais.pacienteId, pacientes.id))
      .where(
        and(
          eq(pacientes.instituicaoId, ctx.instituicaoId),
          eq(pacientes.ativo, true),
          sql`(${sinaisVitais.pacienteId}, ${sinaisVitais.dataAfericao}) IN (
            SELECT sv2.paciente_id, MAX(sv2.data_afericao)
            FROM sinais_vitais sv2
            GROUP BY sv2.paciente_id
          )`
        )
      );
  }),

  // Próximas 5 avaliações geriátricas agendadas
  agasProximas: readClinicalProcedure.query(async ({ ctx }) => {
    const agora = new Date();

    return ctx.db
      .select({
        id: avaliacoesGeriatricas.id,
        pacienteId: avaliacoesGeriatricas.pacienteId,
        profissionalId: avaliacoesGeriatricas.profissionalId,
        dataAvaliacao: avaliacoesGeriatricas.dataAvaliacao,
        katzScore: avaliacoesGeriatricas.katzScore,
        lawtonScore: avaliacoesGeriatricas.lawtonScore,
        meemScore: avaliacoesGeriatricas.meemScore,
        gds15Score: avaliacoesGeriatricas.gds15Score,
        manScore: avaliacoesGeriatricas.manScore,
        tugSegundos: avaliacoesGeriatricas.tugSegundos,
        observacoes: avaliacoesGeriatricas.observacoes,
        pacienteNome: pacientes.nome,
      })
      .from(avaliacoesGeriatricas)
      .innerJoin(pacientes, eq(avaliacoesGeriatricas.pacienteId, pacientes.id))
      .where(
        and(
          eq(pacientes.instituicaoId, ctx.instituicaoId),
          gte(avaliacoesGeriatricas.dataAvaliacao, agora)
        )
      )
      .orderBy(asc(avaliacoesGeriatricas.dataAvaliacao))
      .limit(5);
  }),
});
