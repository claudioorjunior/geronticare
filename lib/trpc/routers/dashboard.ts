import { createTRPCRouter, readClinicalProcedure, adminProcedure } from '../server';
import {
  agas,
  pacientes,
  registros,
  sinaisVitais,
  usuarios,
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

    // Pacientes ativos sem nenhuma AGA concluída no modelo novo (tabela `agas`).
    // Rascunhos continuam contando como pendente — só sai da fila com AGA concluída.
    const [pendentesRow] = await ctx.db
      .select({ value: count() })
      .from(pacientes)
      .where(
        and(
          eq(pacientes.instituicaoId, ctx.instituicaoId),
          eq(pacientes.ativo, true),
          sql`NOT EXISTS (SELECT 1 FROM agas a WHERE a.paciente_id = ${pacientes.id} AND a.status = 'concluida')`
        )
      );

    // SEGURANÇA: projeção mínima explícita — a UI (DashboardUsuario) só usa
    // id/nome/dataNascimento/dataAdmissao/ativo. O CPF não pertence a este
    // resumo: permanece disponível apenas nas telas autorizadas de busca e
    // detalhe do paciente. Sem `columns:`, o Drizzle
    // devolve TODAS as colunas (RG, endereço completo, contato de emergência,
    // telefone, e-mail, foto) para qualquer papel com leitura clínica.
    const pacientesRecentes = await ctx.db.query.pacientes.findMany({
      where: and(eq(pacientes.instituicaoId, ctx.instituicaoId), eq(pacientes.ativo, true)),
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
      .where(
        and(
          eq(pacientes.instituicaoId, ctx.instituicaoId),
          eq(pacientes.ativo, true),
          sql`NOT EXISTS (SELECT 1 FROM agas a WHERE a.paciente_id = ${pacientes.id} AND a.status = 'concluida')`
        )
      )
      .orderBy(asc(pacientes.dataAdmissao))
      .limit(5);
  }),

  /**
   * Métricas institucionais (WAYFINDER T-49): visão operacional do admin.
   * Período fixo "mês corrente" — sem parâmetro de intervalo (YAGNI).
   */
  metricasInstituicao: adminProcedure.query(async ({ ctx }) => {
    const inicioMes = new Date();
    inicioMes.setDate(1);
    inicioMes.setHours(0, 0, 0, 0);

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
        .where(
          and(
            eq(pacientes.instituicaoId, ctx.instituicaoId),
            eq(pacientes.ativo, true)
          )
        ),
      ctx.db
        .select({ value: count() })
        .from(agas)
        .innerJoin(pacientes, eq(agas.pacienteId, pacientes.id))
        .where(
          and(
            eq(pacientes.instituicaoId, ctx.instituicaoId),
            eq(agas.status, 'concluida')
          )
        ),
      ctx.db
        .select({ value: count() })
        .from(pacientes)
        .where(
          and(
            eq(pacientes.instituicaoId, ctx.instituicaoId),
            eq(pacientes.ativo, true),
            sql`NOT EXISTS (SELECT 1 FROM agas a WHERE a.paciente_id = ${pacientes.id} AND a.status = 'concluida')`
          )
        ),
      ctx.db
        .select({ role: usuarios.role, value: count() })
        .from(usuarios)
        .where(
          and(
            eq(usuarios.instituicaoId, ctx.instituicaoId),
            eq(usuarios.ativo, true)
          )
        )
        .groupBy(usuarios.role),
      ctx.db
        .select({ value: count() })
        .from(sinaisVitais)
        .innerJoin(pacientes, eq(sinaisVitais.pacienteId, pacientes.id))
        .where(
          and(
            eq(pacientes.instituicaoId, ctx.instituicaoId),
            gte(sinaisVitais.dataAfericao, inicioMes)
          )
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
