import { z } from 'zod';

export type KatzItemKey = 'banho' | 'vestir' | 'banheiro' | 'transferencia' | 'continencia' | 'alimentacao';
export type KatzOptionValue =
  | 'independente'
  | 'assistencia_parcial'
  | 'assistencia_maior'
  | 'ajuda_sapatos'
  | 'recebe_assistencia'
  | 'nao_utiliza'
  | 'nao_sai_cama'
  | 'controle_completo'
  | 'incontinencia_parcial_total'
  | 'ajuda_cortar'
  | 'dependente';

export const KATZ_ITEMS: ReadonlyArray<{
  key: KatzItemKey;
  label: string;
  instruction: string;
  options: ReadonlyArray<{ value: KatzOptionValue; label: string; score: 0 | 1 }>;
}> = [
  {
    key: 'banho',
    label: 'Banho',
    instruction: 'Inclui entrar e sair do banho e lavar o corpo.',
    options: [
      { value: 'independente', label: 'Não recebe assistência para o banho.', score: 0 },
      { value: 'assistencia_parcial', label: 'Recebe assistência somente para uma parte do corpo, como costas ou uma perna.', score: 0 },
      { value: 'assistencia_maior', label: 'Recebe assistência para mais de uma parte do corpo ou assistência total.', score: 1 },
    ],
  },
  {
    key: 'vestir',
    label: 'Vestir-se',
    instruction: 'Inclui pegar as roupas, vestir roupas íntimas, externas e fechos. Amarrar sapatos pode receber ajuda.',
    options: [
      { value: 'independente', label: 'Pega as roupas e veste-se completamente sem assistência.', score: 0 },
      { value: 'ajuda_sapatos', label: 'Pega as roupas e veste-se sem assistência, exceto para amarrar os sapatos.', score: 0 },
      { value: 'dependente', label: 'Recebe assistência para pegar as roupas ou vestir-se, ou permanece parcialmente vestido.', score: 1 },
    ],
  },
  {
    key: 'banheiro',
    label: 'Ir ao banheiro',
    instruction: 'Inclui ir ao banheiro, higiene íntima e vestir-se após as eliminações.',
    options: [
      { value: 'independente', label: 'Vai ao banheiro, higieniza-se e veste-se sem assistência. Equipamentos de apoio são permitidos.', score: 0 },
      { value: 'recebe_assistencia', label: 'Recebe assistência para ir ao banheiro, higienizar-se, vestir-se ou usar urinol/comadre.', score: 1 },
      { value: 'nao_utiliza', label: 'Não vai ao banheiro para urinar ou evacuar.', score: 1 },
    ],
  },
  {
    key: 'transferencia',
    label: 'Transferência',
    instruction: 'Avalia deitar-se, levantar-se da cama e sentar-se ou levantar-se da cadeira.',
    options: [
      { value: 'independente', label: 'Deita-se e levanta-se da cama ou cadeira sem ajuda. Bengala e andador são permitidos.', score: 0 },
      { value: 'recebe_assistencia', label: 'Recebe ajuda para deitar-se, levantar-se ou transferir-se.', score: 1 },
      { value: 'nao_sai_cama', label: 'Não sai da cama.', score: 1 },
    ],
  },
  {
    key: 'continencia',
    label: 'Continência',
    instruction: 'Avalia o controle de urina e fezes.',
    options: [
      { value: 'controle_completo', label: 'Tem controle completo sobre as eliminações urinária e intestinal.', score: 0 },
      { value: 'incontinencia_parcial_total', label: 'Apresenta incontinência parcial ou total urinária ou intestinal.', score: 1 },
    ],
  },
  {
    key: 'alimentacao',
    label: 'Alimentação',
    instruction: 'Avalia levar a comida do prato à boca. Preparar a comida e cortar alimentos podem ser feitos por outra pessoa.',
    options: [
      { value: 'independente', label: 'Leva a comida do prato à boca sem ajuda.', score: 0 },
      { value: 'ajuda_cortar', label: 'Alimenta-se sozinho, mas recebe ajuda para cortar carne ou passar manteiga.', score: 0 },
      { value: 'dependente', label: 'Recebe ajuda para alimentar-se ou é alimentado parcial ou totalmente por outra via.', score: 1 },
    ],
  },
];

export const katzAnswersSchema = z.object({
  banho: z.enum(['independente', 'assistencia_parcial', 'assistencia_maior']),
  vestir: z.enum(['independente', 'ajuda_sapatos', 'dependente']),
  banheiro: z.enum(['independente', 'recebe_assistencia', 'nao_utiliza']),
  transferencia: z.enum(['independente', 'recebe_assistencia', 'nao_sai_cama']),
  continencia: z.enum(['controle_completo', 'incontinencia_parcial_total']),
  alimentacao: z.enum(['independente', 'ajuda_cortar', 'dependente']),
});
export type KatzAnswers = z.infer<typeof katzAnswersSchema>;

export type LawtonItemKey =
  | 'telefone'
  | 'compras'
  | 'refeicoes'
  | 'tarefas'
  | 'lavanderia'
  | 'transporte'
  | 'medicacao'
  | 'financas';
export const LAWTON_ITEMS: ReadonlyArray<{
  key: LawtonItemKey;
  label: string;
  options: ReadonlyArray<{ value: string; label: string; score: 0 | 1 }>;
}> = [
  {
    key: 'telefone',
    label: 'Uso do telefone',
    options: [
      { value: 'disca_numeros', label: 'Usa o telefone, procura e disca os números.', score: 1 },
      { value: 'alguns_numeros', label: 'Disca alguns números familiares.', score: 1 },
      { value: 'atende_nao_disca', label: 'Atende o telefone, mas não disca.', score: 1 },
      { value: 'nao_utiliza', label: 'Não utiliza o telefone.', score: 0 },
    ],
  },
  {
    key: 'compras',
    label: 'Compras',
    options: [
      { value: 'todas_sem_ajuda', label: 'Faz todas as compras sem ajuda.', score: 1 },
      { value: 'pequenos_itens', label: 'Compra pequenos itens sem ajuda.', score: 0 },
      { value: 'acompanhado', label: 'Sempre precisa ser acompanhado ao fazer compras.', score: 0 },
      { value: 'nao_consegue', label: 'Não consegue fazer compras.', score: 0 },
    ],
  },
  {
    key: 'refeicoes',
    label: 'Preparo de refeições',
    options: [
      { value: 'planeja_prepara_serve', label: 'Planeja, prepara e serve refeições adequadas sem ajuda.', score: 1 },
      { value: 'com_ingredientes', label: 'Prepara refeições adequadas quando recebe os ingredientes.', score: 0 },
      { value: 'aquece_inadequadas', label: 'Aquece refeições preparadas ou prepara refeições nutricionalmente inadequadas.', score: 0 },
      { value: 'precisa_alguem', label: 'Precisa de alguém para preparar e servir as refeições.', score: 0 },
    ],
  },
  {
    key: 'tarefas',
    label: 'Tarefas domésticas',
    options: [
      { value: 'sem_ajuda', label: 'Faz as tarefas domésticas sem ajuda, ou recebe ajuda ocasional para tarefas pesadas.', score: 1 },
      { value: 'leves', label: 'Faz tarefas domésticas leves, como lavar louça e tirar pó.', score: 1 },
      { value: 'leves_nao_mantem', label: 'Faz tarefas leves, mas não mantém a casa adequadamente limpa.', score: 1 },
      { value: 'ajuda_todas', label: 'Precisa de ajuda em todas as tarefas domésticas.', score: 1 },
      { value: 'nenhuma', label: 'Não faz nenhuma tarefa doméstica.', score: 0 },
    ],
  },
  {
    key: 'lavanderia',
    label: 'Lavanderia',
    options: [
      { value: 'sem_ajuda', label: 'Lava roupas sem ajuda.', score: 1 },
      { value: 'pequenos_itens', label: 'Lava pequenos itens, como meias.', score: 1 },
      { value: 'todas_por_outro', label: 'Precisa de alguém para lavar todas as roupas.', score: 0 },
    ],
  },
  {
    key: 'transporte',
    label: 'Transporte',
    options: [
      { value: 'publico_dirige', label: 'Usa transporte público sem ajuda ou dirige um carro.', score: 1 },
      { value: 'taxi', label: 'Chama táxis, mas não utiliza outros transportes públicos.', score: 1 },
      { value: 'publico_acompanhado', label: 'Usa transporte público se acompanhado para receber ajuda.', score: 1 },
      { value: 'carro_com_ajuda', label: 'Só se locomove de táxi ou carro e precisa da ajuda de outra pessoa.', score: 0 },
      { value: 'nao_se_locomove', label: 'Não se locomove.', score: 0 },
    ],
  },
  {
    key: 'medicacao',
    label: 'Medicação',
    options: [
      { value: 'doses_sem_ajuda', label: 'Toma as doses corretas no momento correto sem ajuda.', score: 1 },
      { value: 'organizada', label: 'Toma os medicamentos quando estão organizados em doses separadas.', score: 0 },
      { value: 'nao_consegue', label: 'Não consegue tomar os medicamentos prescritos.', score: 0 },
    ],
  },
  {
    key: 'financas',
    label: 'Finanças',
    options: [
      { value: 'administra', label: 'Administra as finanças sem ajuda.', score: 1 },
      { value: 'pequenos_itens', label: 'Compra pequenos itens, mas precisa de ajuda para transações bancárias e grandes compras.', score: 1 },
      { value: 'nao_administra', label: 'Não consegue administrar o dinheiro.', score: 0 },
    ],
  },
];

export const lawtonAnswersSchema = z.object({
  telefone: z.string().min(1),
  compras: z.string().min(1),
  refeicoes: z.string().min(1),
  tarefas: z.string().min(1),
  lavanderia: z.string().min(1),
  transporte: z.string().min(1),
  medicacao: z.string().min(1),
  financas: z.string().min(1),
});
export type LawtonAnswers = z.infer<typeof lawtonAnswersSchema>;

export type MeemScoreKey =
  | 'orientacao_temporal'
  | 'orientacao_espacial'
  | 'registro'
  | 'atencao_calculo'
  | 'evocacao'
  | 'nomeacao'
  | 'repeticao'
  | 'comando'
  | 'leitura'
  | 'escrita'
  | 'copia';

const scoreOptions = (max: number) =>
  Array.from({ length: max + 1 }, (_, score) => ({
    value: score,
    label: `${score} de ${max} pontos`,
  }));

export const MEEM_ITEMS: ReadonlyArray<{
  key: MeemScoreKey;
  label: string;
  instruction: string;
  max: number;
  options: ReadonlyArray<{ value: number; label: string }>;
}> = [
  { key: 'orientacao_temporal', label: 'Orientação temporal', instruction: 'Ano, estação, dia da semana, dia do mês e mês.', max: 5, options: scoreOptions(5) },
  { key: 'orientacao_espacial', label: 'Orientação espacial', instruction: 'País, estado, cidade, rua ou local e andar.', max: 5, options: scoreOptions(5) },
  { key: 'registro', label: 'Registro', instruction: 'Repetição imediata das três palavras: PENTE, RUA, AZUL.', max: 3, options: scoreOptions(3) },
  { key: 'atencao_calculo', label: 'Atenção e cálculo', instruction: 'Subtrações seriadas de 7 a partir de 100 ou alternativa prevista no protocolo.', max: 5, options: scoreOptions(5) },
  { key: 'evocacao', label: 'Evocação', instruction: 'Evocação tardia das três palavras apresentadas no registro.', max: 3, options: scoreOptions(3) },
  { key: 'nomeacao', label: 'Nomeação', instruction: 'Identificar lápis e relógio de pulso.', max: 2, options: scoreOptions(2) },
  { key: 'repeticao', label: 'Repetição', instruction: 'Repetir: “Nem aqui, nem ali, nem lá”.', max: 1, options: scoreOptions(1) },
  { key: 'comando', label: 'Comando de três estágios', instruction: 'Pegar o papel, dobrar ao meio e colocar no chão.', max: 3, options: scoreOptions(3) },
  { key: 'leitura', label: 'Leitura', instruction: 'Ler e executar: FECHE OS OLHOS.', max: 1, options: scoreOptions(1) },
  { key: 'escrita', label: 'Escrita', instruction: 'Escrever uma frase com pensamento ou ideia completa.', max: 1, options: scoreOptions(1) },
  { key: 'copia', label: 'Cópia', instruction: 'Copiar o desenho apresentado no instrumento.', max: 1, options: scoreOptions(1) },
];

export const meemAnswersSchema = z.object({
  escolaridadeAnos: z.number().int().min(0).max(99).optional(),
  orientacao_temporal: z.number().int().min(0).max(5),
  orientacao_espacial: z.number().int().min(0).max(5),
  registro: z.number().int().min(0).max(3),
  atencao_calculo: z.number().int().min(0).max(5),
  evocacao: z.number().int().min(0).max(3),
  nomeacao: z.number().int().min(0).max(2),
  repeticao: z.number().int().min(0).max(1),
  comando: z.number().int().min(0).max(3),
  leitura: z.number().int().min(0).max(1),
  escrita: z.number().int().min(0).max(1),
  copia: z.number().int().min(0).max(1),
});
export type MeemAnswers = z.infer<typeof meemAnswersSchema>;

export type Gds15ItemKey =
  | 'q1'
  | 'q2'
  | 'q3'
  | 'q4'
  | 'q5'
  | 'q6'
  | 'q7'
  | 'q8'
  | 'q9'
  | 'q10'
  | 'q11'
  | 'q12'
  | 'q13'
  | 'q14'
  | 'q15';
export type Gds15Answer = 'sim' | 'nao';

export const GDS15_ITEMS: ReadonlyArray<{
  key: Gds15ItemKey;
  question: string;
  scoreFor: Gds15Answer;
}> = [
  { key: 'q1', question: 'Está satisfeito(a) com sua vida?', scoreFor: 'nao' },
  { key: 'q2', question: 'Interrompeu muitas de suas atividades?', scoreFor: 'sim' },
  { key: 'q3', question: 'Acha sua vida vazia?', scoreFor: 'sim' },
  { key: 'q4', question: 'Aborrece-se com frequência?', scoreFor: 'sim' },
  { key: 'q5', question: 'Sente-se bem com a vida na maior parte do tempo?', scoreFor: 'nao' },
  { key: 'q6', question: 'Teme que algo ruim lhe aconteça?', scoreFor: 'sim' },
  { key: 'q7', question: 'Sente-se alegre a maior parte do tempo?', scoreFor: 'nao' },
  { key: 'q8', question: 'Sente-se desamparado com frequência?', scoreFor: 'sim' },
  { key: 'q9', question: 'Prefere ficar em casa a sair e fazer coisas novas?', scoreFor: 'sim' },
  { key: 'q10', question: 'Acha que tem mais problemas de memória que outras pessoas?', scoreFor: 'sim' },
  { key: 'q11', question: 'Acha que é maravilhoso estar vivo(a)?', scoreFor: 'nao' },
  { key: 'q12', question: 'Sente-se inútil?', scoreFor: 'sim' },
  { key: 'q13', question: 'Sente-se cheio(a) de energia?', scoreFor: 'nao' },
  { key: 'q14', question: 'Sente-se sem esperança?', scoreFor: 'sim' },
  { key: 'q15', question: 'Acha que os outros têm mais sorte que você?', scoreFor: 'sim' },
];

export const gds15AnswersSchema = z.object({
  q1: z.enum(['sim', 'nao']),
  q2: z.enum(['sim', 'nao']),
  q3: z.enum(['sim', 'nao']),
  q4: z.enum(['sim', 'nao']),
  q5: z.enum(['sim', 'nao']),
  q6: z.enum(['sim', 'nao']),
  q7: z.enum(['sim', 'nao']),
  q8: z.enum(['sim', 'nao']),
  q9: z.enum(['sim', 'nao']),
  q10: z.enum(['sim', 'nao']),
  q11: z.enum(['sim', 'nao']),
  q12: z.enum(['sim', 'nao']),
  q13: z.enum(['sim', 'nao']),
  q14: z.enum(['sim', 'nao']),
  q15: z.enum(['sim', 'nao']),
});
export type Gds15Answers = z.infer<typeof gds15AnswersSchema>;

export const rdc502AnswersSchema = z.object({
  autocuidado: z.enum(['nenhuma', 'ate_tres', 'todas']),
  cognicao: z.enum(['sem_comprometimento', 'alteracao_controlada', 'comprometimento']),
});
export type Rdc502Answers = z.infer<typeof rdc502AnswersSchema>;

export type ManSource = 'imc' | 'panturrilha';
export type ManBaseKey = 'ingesta' | 'perdaPeso' | 'mobilidade' | 'estresse' | 'neuropsicologico';

export const MAN_BASE_ITEMS: ReadonlyArray<{
  key: ManBaseKey;
  label: string;
  options: ReadonlyArray<{ value: number; label: string }>;
}> = [
  {
    key: 'ingesta',
    label: 'Diminuição da ingesta alimentar nos últimos três meses',
    options: [
      { value: 0, label: 'Diminuição severa da ingesta.' },
      { value: 1, label: 'Diminuição moderada da ingesta.' },
      { value: 2, label: 'Sem diminuição da ingesta.' },
    ],
  },
  {
    key: 'perdaPeso',
    label: 'Perda de peso nos últimos três meses',
    options: [
      { value: 0, label: 'Superior a três quilos.' },
      { value: 1, label: 'Não sabe informar.' },
      { value: 2, label: 'Entre um e três quilos.' },
      { value: 3, label: 'Sem perda de peso.' },
    ],
  },
  {
    key: 'mobilidade',
    label: 'Mobilidade',
    options: [
      { value: 0, label: 'Restrito ao leito ou à cadeira de rodas.' },
      { value: 1, label: 'Deambula, mas não é capaz de sair de casa.' },
      { value: 2, label: 'Normal.' },
    ],
  },
  {
    key: 'estresse',
    label: 'Estresse psicológico ou doença aguda nos últimos três meses',
    options: [
      { value: 0, label: 'Sim.' },
      { value: 2, label: 'Não.' },
    ],
  },
  {
    key: 'neuropsicologico',
    label: 'Problemas neuropsicológicos',
    options: [
      { value: 0, label: 'Demência ou depressão graves.' },
      { value: 1, label: 'Demência leve.' },
      { value: 2, label: 'Sem problemas psicológicos.' },
    ],
  },
];

export const MAN_ANTHROPOMETRY = {
  imc: {
    label: 'Índice de massa corporal (IMC)',
    options: [
      { value: 0, label: 'IMC menor que 19.' },
      { value: 1, label: 'IMC de 19 a menor que 21.' },
      { value: 2, label: 'IMC de 21 a menor que 23.' },
      { value: 3, label: 'IMC maior ou igual a 23.' },
    ],
  },
  panturrilha: {
    label: 'Circunferência da panturrilha (CP)',
    options: [
      { value: 0, label: 'CP menor que 31 cm.' },
      { value: 3, label: 'CP maior ou igual a 31 cm.' },
    ],
  },
} as const;

export const manAnswersSchema = z
  .object({
    ingesta: z.number().int().min(0).max(2),
    perdaPeso: z.number().int().min(0).max(3),
    mobilidade: z.number().int().min(0).max(2),
    estresse: z.number().int().min(0).max(2),
    neuropsicologico: z.number().int().min(0).max(2),
    fonteAntropometrica: z.enum(['imc', 'panturrilha']),
    imc: z.number().int().min(0).max(3).optional(),
    panturrilha: z.number().int().min(0).max(3).optional(),
  })
  .superRefine((value, context) => {
    if (value.fonteAntropometrica === 'imc' && value.imc === undefined) {
      context.addIssue({ code: 'custom', path: ['imc'], message: 'Informe a faixa de IMC.' });
    }
    if (value.fonteAntropometrica === 'panturrilha' && value.panturrilha === undefined) {
      context.addIssue({ code: 'custom', path: ['panturrilha'], message: 'Informe a circunferência da panturrilha.' });
    }
  });
export type ManAnswers = z.infer<typeof manAnswersSchema>;

export const agaAnswersSchema = z.object({
  rdc502: rdc502AnswersSchema,
  katz: katzAnswersSchema,
  lawton: lawtonAnswersSchema,
  meem: meemAnswersSchema,
  gds15: gds15AnswersSchema,
  man: manAnswersSchema,
  tug: z.object({ segundos: z.number().int().min(0).max(300) }),
});
export type AgaAnswers = z.infer<typeof agaAnswersSchema>;

export type AgaDraft = {
  katz: Partial<KatzAnswers>;
  rdc502: Partial<Rdc502Answers>;
  lawton: Partial<LawtonAnswers>;
  meem: Partial<Omit<MeemAnswers, 'escolaridadeAnos'>> & { escolaridadeAnos: string };
  gds15: Partial<Gds15Answers>;
  man: Partial<ManAnswers> & { fonteAntropometrica: ManSource };
  tug: { segundos: string };
};

export function createEmptyAgaDraft(): AgaDraft {
  return {
    katz: {},
    rdc502: {},
    lawton: {},
    meem: { escolaridadeAnos: '' },
    gds15: {},
    man: { fonteAntropometrica: 'imc' },
    tug: { segundos: '' },
  };
}

export function draftToAgaAnswers(draft: AgaDraft): AgaAnswers | null {
  const escolaridadeAnos = draft.meem.escolaridadeAnos.trim();
  const parsed = agaAnswersSchema.safeParse({
    rdc502: draft.rdc502,
    katz: draft.katz,
    lawton: draft.lawton,
    meem: {
      ...draft.meem,
      escolaridadeAnos: escolaridadeAnos === '' ? undefined : Number(escolaridadeAnos),
    },
    gds15: draft.gds15,
    man: draft.man,
    tug: {
      segundos: draft.tug.segundos.trim() === '' ? undefined : Number(draft.tug.segundos),
    },
  });

  return parsed.success ? parsed.data : null;
}

export function calcularAgaScores(answers: AgaAnswers) {
  const katzScore = KATZ_ITEMS.reduce((total, item) => {
    const selected = item.options.find((option) => option.value === answers.katz[item.key]);
    return total + (selected?.score ?? 0);
  }, 0);

  const lawtonScore = LAWTON_ITEMS.reduce((total, item) => {
    const selected = item.options.find((option) => option.value === answers.lawton[item.key]);
    return total + (selected?.score ?? 0);
  }, 0);

  const meemScore = MEEM_ITEMS.reduce((total, item) => total + answers.meem[item.key], 0);

  const gds15Score = GDS15_ITEMS.reduce(
    (total, item) => total + (answers.gds15[item.key] === item.scoreFor ? 1 : 0),
    0,
  );

  const manScore =
    answers.man.ingesta +
    answers.man.perdaPeso +
    answers.man.mobilidade +
    answers.man.estresse +
    answers.man.neuropsicologico +
    (answers.man.fonteAntropometrica === 'imc' ? answers.man.imc! : answers.man.panturrilha!);

  return {
    rdc502Autocuidado: answers.rdc502.autocuidado,
    rdc502Cognicao: answers.rdc502.cognicao,
    katzScore,
    lawtonScore,
    meemScore,
    gds15Score,
    manScore,
    tugSegundos: answers.tug.segundos,
  };
}



