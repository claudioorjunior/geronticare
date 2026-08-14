import { z } from 'zod';
import { createTRPCRouter, readClinicalProcedure, adminProcedure } from '../server';
import {
  agas,
  instituicoes,
  pacientes,
  registros,
  sinaisVitais,
  usuarios,
} from '@/lib/db/schema';
import { count, eq, and, desc, asc, gte, sql } from 'drizzle-orm';
import { alertasDeSinais } from '@/lib/dashboard/alertas-vitais';
import { dashboardLayoutSchema, sanitizeLayout } from '@/lib/dashboard/layout';
import { rollingWindowStart, startOfZonedDay, startOfZonedMonth } from '@/lib/dashboard/periodo';

function ativosDaInstituicao(instituicaoId: string) {
  return and(eq(pacientes.instituicaoId, instituicaoId), eq(pacientes.ativo, true));
}

const semAgaConcluida = sql`NOT EXISTS (SELECT 1 FROM agas a WHERE a.paciente_id = ${pacientes.id} AND a.status = 'concluida')`;

export const dashboardRouter = createTRPCRouter({
  // Resumo do dashboard — contagens agregadas + pacientes recentes
  resumo: readClinicalProcedure.query(async ({ ctx }) => {
    const seteDias = rollingWindowStart(new Date(), 7);
    const [totalRow] = await ctx.db
      .select({ value: count() })
      .from(pacientes)
      .where(ativosDaInstituicao(ctx.instituicaoId));

    const [admissoesRow] = await ctx.db
      .select({ value: count() })
      .from(pacientes)
      .where(
        and(
          ativosDaInstituicao(ctx.instituicaoId),
          gte(pacientes.dataAdmissao, seteDias),
        ),
      );

    // Pacientes ativos sem nenhuma AGA concluída no modelo novo (tabela `agas`).
    // Rascunhos continuam contando como pendente — só sai da fila com AGA concluída.
    const [pendentesRow] = await ctx.db
      .select({ value: count() })
      .from(pacientes)
      .where(and(ativosDaInstituicao(ctx.instituicaoId), semAgaConcluida));

    // SEGURANÇA: projeção mínima explícita — a UI só usa
    // id/nome/dataNascimento/dataAdmissao/ativo. O CPF não pertence a este
    // resumo: permanece disponível apenas nas telas autorizadas de busca e
    // detalhe do paciente. Sem `columns:`, o Drizzle
    // devolve TODAS as colunas (RG, endereço completo, contato de emergência,
    // telefone, e-mail, foto) para qualquer papel com leitura clínica.
    const pacientesRecentes = await ctx.db.query.pacientes.findMany({
      where: ativosDaInstituicao(ctx.instituicaoId),
      columns: {
        id: true,
        nome: true,
        dataNascimento: true,
        dataAdmissao: true,
        ativo: true,
        createdAt: true,
      },
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

  /**
   * Painel operacional: um payload para todos os widgets do catálogo.
   * Contagens sem LIMIT. Listas truncadas só na apresentação.
   */
  painel: readClinicalProcedure.query(async ({ ctx }) => {
    const agora = new Date();
    const inicioHoje = startOfZonedDay(agora);
    const inicioMes = startOfZonedMonth(agora);
    const seteDias = rollingWindowStart(agora, 7);
    const daCasa = eq(pacientes.instituicaoId, ctx.instituicaoId);

    const [
      instituicao,
      pacientesAtivos,
      admissoesSemana,
      admissoesMes,
      agasPendentes,
      agasConcluidasMes,
      usuariosPorPapel,
      sinaisNoMes,
      registrosHoje,
      registrosMesPorTipo,
      filaAga,
      pacientesRecentes,
      registrosHojeLista,
      ultimosSinais,
    ] = await Promise.all([
      ctx.db.query.instituicoes.findFirst({
        where: eq(instituicoes.id, ctx.instituicaoId),
        columns: { nome: true },
      }),
      ctx.db
        .select({ value: count() })
        .from(pacientes)
        .where(ativosDaInstituicao(ctx.instituicaoId)),
      ctx.db
        .select({ value: count() })
        .from(pacientes)
        .where(and(ativosDaInstituicao(ctx.instituicaoId), gte(pacientes.dataAdmissao, seteDias))),
      ctx.db
        .select({ value: count() })
        .from(pacientes)
        .where(and(ativosDaInstituicao(ctx.instituicaoId), gte(pacientes.dataAdmissao, inicioMes))),
      ctx.db
        .select({ value: count() })
        .from(pacientes)
        .where(and(ativosDaInstituicao(ctx.instituicaoId), semAgaConcluida)),
      ctx.db
        .select({ value: count() })
        .from(agas)
        .innerJoin(pacientes, eq(agas.pacienteId, pacientes.id))
        .where(
          and(
            daCasa,
            eq(agas.status, 'concluida'),
            gte(agas.concluidaEm, inicioMes),
          ),
        ),
      ctx.db
        .select({ role: usuarios.role, value: count() })
        .from(usuarios)
        .where(and(eq(usuarios.instituicaoId, ctx.instituicaoId), eq(usuarios.ativo, true)))
        .groupBy(usuarios.role),
      ctx.db
        .select({ value: count() })
        .from(sinaisVitais)
        .innerJoin(pacientes, eq(sinaisVitais.pacienteId, pacientes.id))
        .where(and(daCasa, gte(sinaisVitais.dataAfericao, inicioMes))),
      ctx.db
        .select({ value: count() })
        .from(registros)
        .innerJoin(pacientes, eq(registros.pacienteId, pacientes.id))
        .where(and(daCasa, gte(registros.dataRegistro, inicioHoje))),
      ctx.db
        .select({ tipo: registros.tipo, value: count() })
        .from(registros)
        .innerJoin(pacientes, eq(registros.pacienteId, pacientes.id))
        .where(and(daCasa, gte(registros.dataRegistro, inicioMes)))
        .groupBy(registros.tipo),
      ctx.db
        .select({
          pacienteId: pacientes.id,
          pacienteNome: pacientes.nome,
          dataAdmissao: pacientes.dataAdmissao,
        })
        .from(pacientes)
        .where(and(ativosDaInstituicao(ctx.instituicaoId), semAgaConcluida))
        .orderBy(asc(pacientes.dataAdmissao))
        .limit(5),
      ctx.db.query.pacientes.findMany({
        where: ativosDaInstituicao(ctx.instituicaoId),
        columns: {
          id: true,
          nome: true,
          dataNascimento: true,
          dataAdmissao: true,
          ativo: true,
          createdAt: true,
        },
        orderBy: desc(pacientes.createdAt),
        limit: 5,
      }),
      ctx.db
        .select({
          id: registros.id,
          pacienteNome: pacientes.nome,
          tipo: registros.tipo,
          titulo: registros.titulo,
          dataRegistro: registros.dataRegistro,
        })
        .from(registros)
        .innerJoin(pacientes, eq(registros.pacienteId, pacientes.id))
        .where(and(daCasa, gte(registros.dataRegistro, inicioHoje)))
        .orderBy(desc(registros.dataRegistro))
        .limit(8),
      ctx.db
        .select({
          pacienteNome: pacientes.nome,
          pressaoArterialSistolica: sinaisVitais.pressaoArterialSistolica,
          pressaoArterialDiastolica: sinaisVitais.pressaoArterialDiastolica,
          saturacaoO2: sinaisVitais.saturacaoO2,
          temperatura: sinaisVitais.temperatura,
          glicemia: sinaisVitais.glicemia,
        })
        .from(sinaisVitais)
        .innerJoin(pacientes, eq(sinaisVitais.pacienteId, pacientes.id))
        .where(
          and(
            ativosDaInstituicao(ctx.instituicaoId),
            sql`(${sinaisVitais.pacienteId}, ${sinaisVitais.dataAfericao}) IN (
              SELECT sv2.paciente_id, MAX(sv2.data_afericao)
              FROM sinais_vitais sv2
              GROUP BY sv2.paciente_id
            )`,
          ),
        ),
    ]);

    const porPapel: Record<string, number> = {};
    for (const linha of usuariosPorPapel) {
      porPapel[linha.role] = Number(linha.value);
    }

    const porTipo: Record<string, number> = {};
    for (const linha of registrosMesPorTipo) {
      porTipo[linha.tipo] = Number(linha.value);
    }

    const totalAtivos = Number(pacientesAtivos[0]?.value ?? 0);
    const pendentes = Number(agasPendentes[0]?.value ?? 0);
    const alertasVitais = alertasDeSinais(ultimosSinais);

    return {
      instituicaoNome: instituicao?.nome ?? null,
      pacientesAtivos: totalAtivos,
      admissoesSemana: Number(admissoesSemana[0]?.value ?? 0),
      admissoesMes: Number(admissoesMes[0]?.value ?? 0),
      agasPendentes: pendentes,
      agasConcluidasMes: Number(agasConcluidasMes[0]?.value ?? 0),
      coberturaAga: Math.max(0, totalAtivos - pendentes),
      equipeAtiva: Object.values(porPapel).reduce((acc, n) => acc + n, 0),
      equipePorPapel: porPapel,
      sinaisVitaisMes: Number(sinaisNoMes[0]?.value ?? 0),
      registrosHoje: Number(registrosHoje[0]?.value ?? 0),
      evolucoesMes: porTipo.evolucao ?? 0,
      intercorrenciasMes: porTipo.intercorrencia ?? 0,
      alertasVitais: alertasVitais.length,
      filaAga,
      pacientesRecentes,
      registrosHojeLista,
      alertasVitaisLista: alertasVitais,
    };
  }),

  layout: adminProcedure.query(async ({ ctx }) => {
    const instituicao = await ctx.db.query.instituicoes.findFirst({
      where: eq(instituicoes.id, ctx.instituicaoId),
      columns: { dashboardLayout: true },
    });
    return sanitizeLayout(instituicao?.dashboardLayout ?? null, 'admin');
  }),

  salvarLayout: adminProcedure
    .input(z.object({ widgets: dashboardLayoutSchema }))
    .mutation(async ({ ctx, input }) => {
      const widgets = sanitizeLayout(input.widgets, 'admin');
      await ctx.db
        .update(instituicoes)
        .set({ dashboardLayout: widgets, updatedAt: new Date() })
        .where(eq(instituicoes.id, ctx.instituicaoId));
      return widgets;
    }),

  // Registros clínicos do dia atual (filtrados pela instituição)
  registrosHoje: readClinicalProcedure.query(async ({ ctx }) => {
    const hoje = startOfZonedDay(new Date());

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
        and(eq(pacientes.instituicaoId, ctx.instituicaoId), gte(registros.dataRegistro, hoje)),
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
          )`,
        ),
      );
  }),

  // Próximas AGAs a realizar: pacientes ativos ainda sem AGA concluída no
  // modelo novo (não existe agendamento; a fila é ordenada pela admissão,
  // quem espera há mais tempo primeiro).
  agasProximas: readClinicalProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select({
        pacienteId: pacientes.id,
        pacienteNome: pacientes.nome,
        dataAdmissao: pacientes.dataAdmissao,
      })
      .from(pacientes)
      .where(and(ativosDaInstituicao(ctx.instituicaoId), semAgaConcluida))
      .orderBy(asc(pacientes.dataAdmissao))
      .limit(5);
  }),

  /**
   * Métricas institucionais (WAYFINDER T-49): visão operacional do admin.
   * Período fixo "mês corrente" em America/Sao_Paulo.
   */
  metricasInstituicao: adminProcedure.query(async ({ ctx }) => {
    const inicioMes = startOfZonedMonth(new Date());

    const [
      pacientesAtivos,
      agasConcluidas,
      agasPendentes,
      usuariosPorPapel,
      sinaisNoMes,
    ] = await Promise.all([
      ctx.db
        .select({ value: count() })
        .from(pacientes)
        .where(ativosDaInstituicao(ctx.instituicaoId)),
      ctx.db
        .select({ value: count() })
        .from(agas)
        .innerJoin(pacientes, eq(agas.pacienteId, pacientes.id))
        .where(
          and(
            eq(pacientes.instituicaoId, ctx.instituicaoId),
            eq(agas.status, 'concluida'),
          ),
        ),
      ctx.db
        .select({ value: count() })
        .from(pacientes)
        .where(and(ativosDaInstituicao(ctx.instituicaoId), semAgaConcluida)),
      ctx.db
        .select({ role: usuarios.role, value: count() })
        .from(usuarios)
        .where(
          and(
            eq(usuarios.instituicaoId, ctx.instituicaoId),
            eq(usuarios.ativo, true),
          ),
        )
        .groupBy(usuarios.role),
      ctx.db
        .select({ value: count() })
        .from(sinaisVitais)
        .innerJoin(pacientes, eq(sinaisVitais.pacienteId, pacientes.id))
        .where(
          and(
            eq(pacientes.instituicaoId, ctx.instituicaoId),
            gte(sinaisVitais.dataAfericao, inicioMes),
          ),
        ),
    ]);

    const porPapel: Record<string, number> = {};
    for (const linha of usuariosPorPapel) {
      porPapel[linha.role] = Number(linha.value);
    }

    return {
      pacientesAtivos: Number(pacientesAtivos[0]?.value ?? 0),
      agasConcluidas: Number(agasConcluidas[0]?.value ?? 0),
      agasPendentes: Number(agasPendentes[0]?.value ?? 0),
      usuariosAtivosPorPapel: porPapel,
      sinaisVitaisNoMes: Number(sinaisNoMes[0]?.value ?? 0),
    };
  }),
});
