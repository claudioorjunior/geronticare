// Seed de aplicações de escalas (aleatórias) no Neon.
// Gera respostas válidas por instrumento, avalia com evaluateInstrument de
// produção (mesma classificação do app) e grava em aplicacoesInstrumentos.
// Uso: DATABASE_URL="postgresql://..." npx tsx scripts/seed-escalas-neon.ts
import { getDb } from '@/lib/db';
import { and, eq, sql } from 'drizzle-orm';
import { aplicacoesInstrumentos, instituicoes, pacientes, usuarios } from '@/lib/db/schema';
import {
  GDS15_ITEMS,
  KATZ_ITEMS,
  LAWTON_ITEMS,
  MAN_ANTHROPOMETRY,
  MAN_BASE_ITEMS,
  MEEM_ITEMS,
  type Gds15Answer,
  type ManSource,
} from '@/lib/validations/aga-form';
import {
  getInstrumentDefinition,
  INSTRUMENTO_SLUGS,
  evaluateInstrument,
} from '@/lib/instrumentos/instrumentos';

// ── geradores aleatórios ─────────────────────────────────────────────────────
function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function respostasKatz(): Record<string, string> {
  const respostas: Record<string, string> = {};
  for (const item of KATZ_ITEMS) {
    respostas[item.key] = pick(item.options).value;
  }
  return respostas;
}

function respostasLawton(): Record<string, string> {
  const respostas: Record<string, string> = {};
  for (const item of LAWTON_ITEMS) {
    respostas[item.key] = pick(item.options).value;
  }
  return respostas;
}

function respostasMeem(): Record<string, number> {
  const respostas: Record<string, number> = {
    escolaridadeAnos: randInt(0, 20),
  };
  for (const item of MEEM_ITEMS) {
    respostas[item.key] = randInt(0, item.max);
  }
  return respostas;
}

function respostasGds15(): Record<string, Gds15Answer> {
  const respostas: Record<string, Gds15Answer> = {};
  for (const item of GDS15_ITEMS) {
    respostas[item.key] = pick(['sim', 'nao'] as const);
  }
  return respostas;
}

function respostasMan(): Record<string, number | ManSource> {
  const fonteAntropometrica: ManSource = pick(['imc', 'panturrilha'] as const);
  const antropometria =
    fonteAntropometrica === 'imc'
      ? pick(MAN_ANTHROPOMETRY.imc.options).value
      : pick(MAN_ANTHROPOMETRY.panturrilha.options).value;
  return {
    ingesta: pick(MAN_BASE_ITEMS[0].options).value,
    perdaPeso: pick(MAN_BASE_ITEMS[1].options).value,
    mobilidade: pick(MAN_BASE_ITEMS[2].options).value,
    estresse: pick(MAN_BASE_ITEMS[3].options).value,
    neuropsicologico: pick(MAN_BASE_ITEMS[4].options).value,
    fonteAntropometrica,
    [fonteAntropometrica]: antropometria,
  };
}

function respostasTug(): { segundos: number } {
  return { segundos: randInt(5, 40) };
}

const GERADORES: Record<(typeof INSTRUMENTO_SLUGS)[number], () => Record<string, unknown>> = {
  katz: respostasKatz,
  lawton: respostasLawton,
  meem: respostasMeem,
  gds15: respostasGds15,
  man: respostasMan,
  tug: respostasTug,
};

// ── main ─────────────────────────────────────────────────────────────────────
async function main() {
  const db = await getDb();

  const inst = await db.query.instituicoes.findFirst({
    where: eq(instituicoes.nome, 'ILPI Mock'),
  });
  if (!inst) {
    console.error('Instituição "ILPI Mock" não encontrada. Rode scripts/seed-neon.ts antes.');
    process.exit(1);
  }

  // Profissional que assina as aplicações. O seed de usuários não define
  // especialidade, mas o router exige isNotNull(especialidade) — completa aqui.
  let profissional = await db.query.usuarios.findFirst({
    where: and(
      eq(usuarios.instituicaoId, inst.id),
      eq(usuarios.role, 'profissional'),
      eq(usuarios.ativo, true),
    ),
  });
  if (!profissional) {
    console.error('Nenhum profissional ativo na instituição. Rode scripts/seed-neon.ts antes.');
    process.exit(1);
  }
  if (!profissional.especialidade) {
    const [atualizado] = await db
      .update(usuarios)
      .set({ especialidade: 'medicina', registroProfissional: 'CRM-SP 000000' })
      .where(eq(usuarios.id, profissional.id))
      .returning();
    profissional = atualizado;
    console.log(`profissional ${profissional.nome}: especialidade completada (${profissional.especialidade})`);
  }

  const listaPacientes = await db.query.pacientes.findMany({
    where: eq(pacientes.instituicaoId, inst.id),
  });
  if (listaPacientes.length === 0) {
    console.error('Nenhum paciente na instituição. Rode scripts/seed-pacientes-neon.ts antes.');
    process.exit(1);
  }
  console.log(`${listaPacientes.length} pacientes encontrados`);

  const agora = Date.now();
  const DIAS_ATRAS = 90 * 24 * 60 * 60 * 1000; // aplicações dentro dos últimos 90 dias
  const instrumentos = [...INSTRUMENTO_SLUGS];

  let criadas = 0;
  let puladas = 0;

  for (const paciente of listaPacientes) {
    for (const instrumento of instrumentos) {
      const jaExiste = await db.query.aplicacoesInstrumentos.findFirst({
        where: and(
          eq(aplicacoesInstrumentos.pacienteId, paciente.id),
          eq(aplicacoesInstrumentos.instrumento, instrumento),
        ),
        columns: { id: true },
      });
      if (jaExiste) {
        puladas += 1;
        continue;
      }

      const respostas = GERADORES[instrumento]();
      const resultado = evaluateInstrument(instrumento, respostas);
      const definicao = getInstrumentDefinition(instrumento);

      await db.insert(aplicacoesInstrumentos).values({
        pacienteId: paciente.id,
        instrumento,
        profissionalId: profissional!.id,
        registradoPorId: profissional!.id,
        dataAplicacao: new Date(agora - randInt(1, DIAS_ATRAS)),
        respostas,
        escore: resultado.escore,
        classificacao: resultado.classificacao,
        descricaoClassificacao: resultado.descricao,
        versaoInstrumento: definicao.versao,
      });

      criadas += 1;
    }
  }

  const total = await db
    .select({ count: sql`count(*)` })
    .from(aplicacoesInstrumentos)
    .innerJoin(pacientes, eq(aplicacoesInstrumentos.pacienteId, pacientes.id))
    .where(eq(pacientes.instituicaoId, inst.id));

  console.log(`\nSeed OK. criadas=${criadas}, já existentes=${puladas}, total na instituição=${total[0].count}`);
  process.exit(0);
}

main().catch((err) => {
  console.error('Falha no seed:', (err as Error).message);
  process.exit(1);
});
