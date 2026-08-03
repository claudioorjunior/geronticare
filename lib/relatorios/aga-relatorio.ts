import type { InstrumentoSlug } from '@/lib/instrumentos/instrumentos';
import type { RouterOutputs } from '@/lib/trpc/types';
import {
  interpretarEscala,
  type Rdc502Autocuidado,
  type Rdc502Cognicao,
} from '@/lib/validations/escalas';

/**
 * Maps a consolidated AGA snapshot (agas.buscar) into the report shape.
 *
 * The new AGA model is a consolidation of instrument applications — it has no
 * free-text comorbidity/medication/support sections. Those fields are kept in
 * the report contract as empty values so the legacy report UI stays intact
 * (HARNESS: functional change only, no visual redesign).
 */

export type AgaDetail = RouterOutputs['agas']['buscar'];
export type AgaAplicacao = AgaDetail['aplicacoes'][number];

export type RelatorioEscalaKey = 'katz' | 'lawton' | 'meem' | 'gds15' | 'man' | 'tug';

export type RelatorioEscala = {
  key: RelatorioEscalaKey;
  label: string;
  max?: number;
  unit?: string;
  interpretation: string | null;
  score: number | null;
};

export type RelatorioAga = {
  dataAvaliacao: Date;
  profissional: string | null;
  especialidade: string | null;
  rdc502Autocuidado: Rdc502Autocuidado | null;
  rdc502Cognicao: Rdc502Cognicao | null;
  escalas: RelatorioEscala[];
  observacoes: string | null;
  comorbidades: string[];
  medicamentos: { nome: string; dose: string; frequencia: string }[];
  suporteSocial: string | null;
  moradia: string | null;
};

const ESCALA_DEFINICOES: ReadonlyArray<{
  key: RelatorioEscalaKey;
  instrumento: Exclude<InstrumentoSlug, 'rdc502'>;
  label: string;
  max?: number;
  unit?: string;
}> = [
  { key: 'katz', instrumento: 'katz', label: 'Katz — autonomia básica', max: 6 },
  { key: 'lawton', instrumento: 'lawton', label: 'Lawton — autonomia instrumental', max: 8 },
  { key: 'meem', instrumento: 'meem', label: 'MEEM — cognição', max: 30 },
  { key: 'gds15', instrumento: 'gds15', label: 'GDS-15 — humor', max: 15 },
  { key: 'man', instrumento: 'man', label: 'MAN — nutrição', max: 14 },
  { key: 'tug', instrumento: 'tug', label: 'TUG — mobilidade', unit: 'segundos' },
];

function isAutocuidado(value: unknown): value is Rdc502Autocuidado {
  return value === 'nenhuma' || value === 'ate_tres' || value === 'todas';
}

function isCognicao(value: unknown): value is Rdc502Cognicao {
  return (
    value === 'sem_comprometimento' ||
    value === 'alteracao_controlada' ||
    value === 'comprometimento'
  );
}

export function montarRelatorioAga(aga: AgaDetail): RelatorioAga {
  // Last application per instrument wins; the backend enforces one per AGA.
  const porInstrumento = new Map<string, AgaAplicacao>();
  for (const aplicacao of aga.aplicacoes) {
    porInstrumento.set(aplicacao.instrumento, aplicacao);
  }

  const rdc = porInstrumento.get('rdc502');
  const respostasRdc = rdc?.respostas as
    | { autocuidado?: unknown; cognicao?: unknown }
    | null
    | undefined;

  const escalas: RelatorioEscala[] = ESCALA_DEFINICOES.map((definicao) => {
    const aplicacao = porInstrumento.get(definicao.instrumento);
    const score = aplicacao?.escore ?? null;
    return {
      key: definicao.key,
      label: definicao.label,
      max: definicao.max,
      unit: definicao.unit,
      interpretation:
        score === null ? null : interpretarEscala(definicao.instrumento, score),
      score,
    };
  });

  return {
    dataAvaliacao: aga.dataAvaliacao,
    profissional: aga.concluidaPor?.nome ?? null,
    especialidade: aga.concluidaPor?.especialidade ?? null,
    rdc502Autocuidado: isAutocuidado(respostasRdc?.autocuidado)
      ? respostasRdc.autocuidado
      : null,
    rdc502Cognicao: isCognicao(respostasRdc?.cognicao) ? respostasRdc.cognicao : null,
    escalas,
    observacoes: aga.observacoes,
    comorbidades: [],
    medicamentos: [],
    suporteSocial: null,
    moradia: null,
  };
}
