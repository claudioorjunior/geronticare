import {
  GDS15_ITEMS,
  KATZ_ITEMS,
  LAWTON_ITEMS,
  MAN_ANTHROPOMETRY,
  MAN_BASE_ITEMS,
  MEEM_ITEMS,
} from '@/lib/validations/aga-form';
import {
  getInstrumentDefinition,
  type InstrumentoSlug,
} from './instrumentos';

export type InstrumentDraft = Record<string, string>;

export type OpcaoCampoInstrumento = {
  value: string | number;
  label: string;
};

type CondicaoCampo = {
  key: string;
  equals: string | number;
};

type CampoBase = {
  key: string;
  label: string;
  hint?: string;
  required: boolean;
  condition?: CondicaoCampo;
};

export type CampoEscolhaInstrumento = CampoBase & {
  type: 'choice';
  control: 'radio' | 'select';
  options: readonly OpcaoCampoInstrumento[];
};

export type CampoNumeroInstrumento = CampoBase & {
  type: 'number';
  min: number;
  max: number;
  step: number;
  unit?: string;
};

export type CampoInstrumento =
  | CampoEscolhaInstrumento
  | CampoNumeroInstrumento;

const rdc502Fields: readonly CampoInstrumento[] = [
  {
    type: 'choice',
    control: 'radio',
    key: 'autocuidado',
    label: 'Necessidade de ajuda nas atividades de autocuidado',
    hint: 'Considere alimentação, continência, transferência, higiene pessoal e banho.',
    required: true,
    options: [
      {
        value: 'nenhuma',
        label: 'Independente nas atividades de autocuidado',
      },
      {
        value: 'ate_tres',
        label: 'Necessita ajuda em até três atividades de autocuidado',
      },
      {
        value: 'todas',
        label: 'Necessita ajuda em todas as atividades de autocuidado',
      },
    ],
  },
  {
    type: 'choice',
    control: 'radio',
    key: 'cognicao',
    label: 'Condição cognitiva',
    required: true,
    options: [
      {
        value: 'sem_comprometimento',
        label: 'Sem comprometimento cognitivo',
      },
      {
        value: 'alteracao_controlada',
        label: 'Alteração cognitiva controlada',
      },
      {
        value: 'comprometimento',
        label: 'Comprometimento cognitivo',
      },
    ],
  },
];

const katzFields: readonly CampoInstrumento[] = KATZ_ITEMS.map((item) => ({
  type: 'choice',
  control: 'radio',
  key: item.key,
  label: item.label,
  hint: item.instruction,
  required: true,
  options: item.options.map(({ value, label }) => ({ value, label })),
}));

const lawtonFields: readonly CampoInstrumento[] = LAWTON_ITEMS.map((item) => ({
  type: 'choice',
  control: 'radio',
  key: item.key,
  label: item.label,
  required: true,
  options: item.options.map(({ value, label }) => ({ value, label })),
}));

const meemFields: readonly CampoInstrumento[] = [
  {
    type: 'number',
    key: 'escolaridadeAnos',
    label: 'Escolaridade em anos completos',
    hint: 'Campo opcional; não altera o cálculo atual do escore.',
    required: false,
    min: 0,
    max: 99,
    step: 1,
    unit: 'anos',
  },
  ...MEEM_ITEMS.map((item) => ({
    type: 'choice' as const,
    control: 'select' as const,
    key: item.key,
    label: item.label,
    hint: item.instruction,
    required: true,
    options: item.options.map(({ value, label }) => ({ value, label })),
  })),
];

const gds15Fields: readonly CampoInstrumento[] = GDS15_ITEMS.map((item) => ({
  type: 'choice',
  control: 'radio',
  key: item.key,
  label: item.question,
  required: true,
  options: [
    { value: 'sim', label: 'Sim' },
    { value: 'nao', label: 'Não' },
  ],
}));

const manFields: readonly CampoInstrumento[] = [
  ...MAN_BASE_ITEMS.map((item) => ({
    type: 'choice' as const,
    control: 'radio' as const,
    key: item.key,
    label: item.label,
    required: true,
    options: item.options.map(({ value, label }) => ({ value, label })),
  })),
  {
    type: 'choice',
    control: 'radio',
    key: 'fonteAntropometrica',
    label: 'Medida antropométrica disponível',
    hint: 'Escolha uma única fonte para concluir a triagem.',
    required: true,
    options: [
      { value: 'imc', label: 'Índice de massa corporal (IMC)' },
      {
        value: 'panturrilha',
        label: 'Circunferência da panturrilha',
      },
    ],
  },
  {
    type: 'choice',
    control: 'radio',
    key: 'imc',
    label: MAN_ANTHROPOMETRY.imc.label,
    required: true,
    condition: { key: 'fonteAntropometrica', equals: 'imc' },
    options: MAN_ANTHROPOMETRY.imc.options,
  },
  {
    type: 'choice',
    control: 'radio',
    key: 'panturrilha',
    label: MAN_ANTHROPOMETRY.panturrilha.label,
    required: true,
    condition: { key: 'fonteAntropometrica', equals: 'panturrilha' },
    options: MAN_ANTHROPOMETRY.panturrilha.options,
  },
];

const tugFields: readonly CampoInstrumento[] = [
  {
    type: 'number',
    key: 'segundos',
    label: 'Tempo para concluir o teste',
    hint: 'Informe o tempo total do Timed Up and Go em segundos inteiros.',
    required: true,
    min: 0,
    max: 300,
    step: 1,
    unit: 'segundos',
  },
];

const fieldsByInstrument: Record<
  InstrumentoSlug,
  readonly CampoInstrumento[]
> = {
  rdc502: rdc502Fields,
  katz: katzFields,
  lawton: lawtonFields,
  meem: meemFields,
  gds15: gds15Fields,
  man: manFields,
  tug: tugFields,
};

export function getInstrumentFields(
  slug: InstrumentoSlug,
): readonly CampoInstrumento[] {
  return fieldsByInstrument[slug];
}

export function createInstrumentDraft(slug: InstrumentoSlug): InstrumentDraft {
  return Object.fromEntries(
    getInstrumentFields(slug).map((field) => [field.key, '']),
  );
}

export function isInstrumentFieldVisible(
  field: CampoInstrumento,
  draft: InstrumentDraft,
): boolean {
  if (!field.condition) return true;
  return draft[field.condition.key] === String(field.condition.equals);
}

export function parseInstrumentDraft(
  slug: InstrumentoSlug,
  draft: InstrumentDraft,
): Record<string, unknown> {
  const respostas: Record<string, unknown> = {};

  for (const field of getInstrumentFields(slug)) {
    if (!isInstrumentFieldVisible(field, draft)) continue;

    const rawValue = draft[field.key] ?? '';
    if (rawValue === '' && !field.required) continue;
    if (rawValue === '') continue;

    if (field.type === 'number') {
      respostas[field.key] = Number(rawValue);
      continue;
    }

    const selectedOption = field.options.find(
      (option) => String(option.value) === rawValue,
    );
    respostas[field.key] = selectedOption?.value ?? rawValue;
  }

  return getInstrumentDefinition(slug).schema.parse(respostas);
}

export function formatInstrumentAnswer(
  slug: InstrumentoSlug,
  key: string,
  value: unknown,
): string {
  const field = getInstrumentFields(slug).find((candidate) => candidate.key === key);

  if (!field || value === null || value === undefined || value === '') {
    return value === null || value === undefined || value === ''
      ? 'Não informado'
      : String(value);
  }

  if (field.type === 'choice') {
    return (
      field.options.find((option) => option.value === value)?.label ?? String(value)
    );
  }

  return field.unit ? `${String(value)} ${field.unit}` : String(value);
}
