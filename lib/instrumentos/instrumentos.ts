import { z } from 'zod';
import {
  GDS15_ITEMS,
  KATZ_ITEMS,
  LAWTON_ITEMS,
  MAN_BASE_ITEMS,
  MEEM_ITEMS,
  gds15AnswersSchema,
  katzAnswersSchema,
  lawtonAnswersSchema,
  manAnswersSchema,
  meemAnswersSchema,
  rdc502AnswersSchema,
} from '@/lib/validations/aga-form';
import {
  classificarGrauDependenciaRdc502,
  interpretarEscala,
} from '@/lib/validations/escalas';

export const INSTRUMENTO_SLUGS = [
  'rdc502',
  'katz',
  'lawton',
  'meem',
  'gds15',
  'man',
  'tug',
] as const;

export type InstrumentoSlug = (typeof INSTRUMENTO_SLUGS)[number];

export type ResultadoInstrumento = {
  escore: number | null;
  classificacao: string;
  descricao: string;
};

export type DefinicaoInstrumento = {
  slug: InstrumentoSlug;
  nome: string;
  nomeCurto: string;
  dominio: string;
  descricao: string;
  versao: string;
  itens: readonly unknown[];
  schema: z.ZodType<Record<string, unknown>>;
};

const katzSchema = z.strictObject(katzAnswersSchema.shape);
const rdc502Schema = z.strictObject(rdc502AnswersSchema.shape);
const lawtonSchema = z
  .strictObject(lawtonAnswersSchema.shape)
  .superRefine((respostas, context) => {
    for (const item of LAWTON_ITEMS) {
      const opcaoValida = item.options.some(
        (option) => option.value === respostas[item.key],
      );

      if (!opcaoValida) {
        context.addIssue({
          code: 'custom',
          path: [item.key],
          message: 'Selecione uma opção válida.',
        });
      }
    }
  });
const meemSchema = z.strictObject(meemAnswersSchema.shape);
const gds15Schema = z.strictObject(gds15AnswersSchema.shape);
const manSchema = z
  .strictObject(manAnswersSchema.shape)
  .superRefine((respostas, context) => {
    if (
      respostas.fonteAntropometrica === 'imc' &&
      respostas.imc === undefined
    ) {
      context.addIssue({
        code: 'custom',
        path: ['imc'],
        message: 'Informe a faixa de IMC.',
      });
    }

    if (
      respostas.fonteAntropometrica === 'panturrilha' &&
      respostas.panturrilha === undefined
    ) {
      context.addIssue({
        code: 'custom',
        path: ['panturrilha'],
        message: 'Informe a circunferência da panturrilha.',
      });
    }
  });
const tugSchema = z.strictObject({
  segundos: z.number().int().min(0).max(300),
});

const definitions: Record<InstrumentoSlug, DefinicaoInstrumento> = {
  rdc502: {
    slug: 'rdc502',
    nome: 'Classificação RDC 502',
    nomeCurto: 'RDC 502',
    dominio: 'Grau de dependência',
    descricao: 'Classifica o grau de dependência para autocuidado e cognição conforme a RDC 502/2021.',
    versao: '1.0',
    itens: [],
    schema: rdc502Schema,
  },
  katz: {
    slug: 'katz',
    nome: 'Índice de Katz',
    nomeCurto: 'Katz',
    dominio: 'Atividades básicas',
    descricao: 'Avalia a independência nas atividades básicas da vida diária.',
    versao: '1.0',
    itens: KATZ_ITEMS,
    schema: katzSchema,
  },
  lawton: {
    slug: 'lawton',
    nome: 'Escala de Lawton',
    nomeCurto: 'Lawton',
    dominio: 'Atividades instrumentais',
    descricao: 'Avalia autonomia e necessidade de assistência nas atividades instrumentais da vida diária.',
    versao: '1.0',
    itens: LAWTON_ITEMS,
    schema: lawtonSchema,
  },
  meem: {
    slug: 'meem',
    nome: 'Mini-Exame do Estado Mental',
    nomeCurto: 'MEEM',
    dominio: 'Cognição',
    descricao: 'Rastreia orientação, memória, atenção, linguagem e habilidade visuoespacial.',
    versao: '1.0',
    itens: MEEM_ITEMS,
    schema: meemSchema,
  },
  gds15: {
    slug: 'gds15',
    nome: 'Escala de Depressão Geriátrica (GDS-15)',
    nomeCurto: 'GDS-15',
    dominio: 'Humor',
    descricao: 'Rastreia sintomas depressivos por meio de quinze perguntas objetivas.',
    versao: '1.0',
    itens: GDS15_ITEMS,
    schema: gds15Schema,
  },
  man: {
    slug: 'man',
    nome: 'Mini Avaliação Nutricional',
    nomeCurto: 'MAN',
    dominio: 'Nutrição',
    descricao: 'Identifica risco nutricional com dados clínicos e antropométricos.',
    versao: '1.0',
    itens: MAN_BASE_ITEMS,
    schema: manSchema,
  },
  tug: {
    slug: 'tug',
    nome: 'Timed Up and Go',
    nomeCurto: 'TUG',
    dominio: 'Mobilidade',
    descricao: 'Registra o tempo de mobilidade funcional e indica risco de queda.',
    versao: '1.0',
    itens: [],
    schema: tugSchema,
  },
};

const instrumentoSlugSet = new Set<string>(INSTRUMENTO_SLUGS);

export function isInstrumentoSlug(value: string): value is InstrumentoSlug {
  return instrumentoSlugSet.has(value);
}

export function getInstrumentDefinition(slug: InstrumentoSlug): DefinicaoInstrumento {
  return definitions[slug];
}

function resultadoComEscore(
  slug: Exclude<InstrumentoSlug, 'rdc502'>,
  escore: number,
): ResultadoInstrumento {
  const classificacao = interpretarEscala(slug, escore);

  if (!classificacao) {
    throw new Error(`Não foi possível classificar o instrumento ${slug}.`);
  }

  return {
    escore,
    classificacao,
    descricao: classificacao,
  };
}

export function evaluateInstrument(
  slug: InstrumentoSlug,
  respostas: unknown,
): ResultadoInstrumento {
  if (slug === 'rdc502') {
    const parsed = rdc502Schema.parse(respostas);
    const resultado = classificarGrauDependenciaRdc502(
      parsed.autocuidado,
      parsed.cognicao,
    );

    if (!resultado) {
      throw new Error('Não foi possível classificar a RDC 502.');
    }

    return {
      escore: null,
      classificacao: resultado.label,
      descricao: resultado.fundamento,
    };
  }

  if (slug === 'katz') {
    const parsed = katzSchema.parse(respostas);
    const escore = KATZ_ITEMS.reduce((total, item) => {
      const selected = item.options.find(
        (option) => option.value === parsed[item.key],
      );
      return total + (selected?.score ?? 0);
    }, 0);

    return resultadoComEscore(slug, escore);
  }

  if (slug === 'lawton') {
    const parsed = lawtonSchema.parse(respostas);
    const escore = LAWTON_ITEMS.reduce((total, item) => {
      const selected = item.options.find(
        (option) => option.value === parsed[item.key],
      );
      return total + (selected?.score ?? 0);
    }, 0);

    return resultadoComEscore(slug, escore);
  }

  if (slug === 'meem') {
    const parsed = meemSchema.parse(respostas);
    const escore = MEEM_ITEMS.reduce(
      (total, item) => total + parsed[item.key],
      0,
    );

    return resultadoComEscore(slug, escore);
  }

  if (slug === 'gds15') {
    const parsed = gds15Schema.parse(respostas);
    const escore = GDS15_ITEMS.reduce(
      (total, item) =>
        total + (parsed[item.key] === item.scoreFor ? 1 : 0),
      0,
    );

    return resultadoComEscore(slug, escore);
  }

  if (slug === 'man') {
    const parsed = manSchema.parse(respostas);
    const antropometria =
      parsed.fonteAntropometrica === 'imc'
        ? parsed.imc
        : parsed.panturrilha;

    if (antropometria === undefined) {
      throw new Error('Informe a medida antropométrica selecionada.');
    }

    const escore =
      parsed.ingesta +
      parsed.perdaPeso +
      parsed.mobilidade +
      parsed.estresse +
      parsed.neuropsicologico +
      antropometria;

    return resultadoComEscore(slug, escore);
  }

  const parsed = tugSchema.parse(respostas);
  return resultadoComEscore(slug, parsed.segundos);
}
