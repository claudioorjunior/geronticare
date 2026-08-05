
export type AgaComparisonScale = 'katz' | 'lawton' | 'meem' | 'gds15' | 'man' | 'tug';
export type AgaTrend = 'melhora' | 'piora' | 'estavel' | 'indisponivel';

export type AgaComparisonInput = {
  katzScore?: number | null;
  lawtonScore?: number | null;
  meemScore?: number | null;
  gds15Score?: number | null;
  manScore?: number | null;
  tugSegundos?: number | null;
};

export type AgaScaleComparison = {
  escala: AgaComparisonScale;
  label: string;
  unidade: 'pontos' | 'segundos';
  anterior: number | null;
  atual: number | null;
  delta: number | null;
  tendencia: AgaTrend;
  higherIsBetter: boolean;
};

export type AgaComparisonResult = {
  escalas: AgaScaleComparison[];
  resumo: {
    melhoras: number;
    estaveis: number;
    pontosDeAtencao: number;
  };
};

export type AgaRdcComparisonInput = {
  classificacao: string | null;
};

export type AgaRdcComparisonResult = {
  atual: string;
  anterior: string;
  tendencia: AgaTrend;
  mensagem: string;
};

const SCALE_DEFINITIONS: ReadonlyArray<{
  escala: AgaComparisonScale;
  field: keyof AgaComparisonInput;
  label: string;
  unidade: 'pontos' | 'segundos';
  higherIsBetter: boolean;
}> = [
  { escala: 'katz', field: 'katzScore', label: 'Autonomia básica — Katz', unidade: 'pontos', higherIsBetter: false },
  { escala: 'lawton', field: 'lawtonScore', label: 'Autonomia instrumental — Lawton', unidade: 'pontos', higherIsBetter: true },
  { escala: 'meem', field: 'meemScore', label: 'Cognição — MEEM', unidade: 'pontos', higherIsBetter: true },
  { escala: 'gds15', field: 'gds15Score', label: 'Humor — GDS-15', unidade: 'pontos', higherIsBetter: false },
  { escala: 'man', field: 'manScore', label: 'Nutrição — MAN', unidade: 'pontos', higherIsBetter: true },
  { escala: 'tug', field: 'tugSegundos', label: 'Mobilidade — TUG', unidade: 'segundos', higherIsBetter: false },
];

export function compararClassificacaoRdc502(
  atual: AgaRdcComparisonInput,
  anterior: AgaRdcComparisonInput,
): AgaRdcComparisonResult {
  const atualGrau = getRdcGrade(atual);
  const anteriorGrau = getRdcGrade(anterior);

  if (!atualGrau || !anteriorGrau) {
    return {
      atual: atualGrau ?? 'Não informada',
      anterior: anteriorGrau ?? 'Não informada',
      tendencia: 'indisponivel',
      mensagem: 'Não foi possível comparar a classificação funcional.',
    };
  }

  const ordem = { 'Grau I': 1, 'Grau II': 2, 'Grau III': 3 } as const;
  const delta = ordem[atualGrau] - ordem[anteriorGrau];
  const tendencia: AgaTrend = delta < 0 ? 'melhora' : delta > 0 ? 'piora' : 'estavel';

  return {
    atual: atualGrau,
    anterior: anteriorGrau,
    tendencia,
    mensagem: tendencia === 'melhora'
      ? 'A classificação funcional reduziu desde a avaliação anterior.'
      : tendencia === 'piora'
        ? 'A classificação funcional aumentou desde a avaliação anterior.'
        : 'A classificação funcional foi mantida desde a avaliação anterior.',
  };
}

function parseGrauLabel(label: string | null | undefined): 'Grau I' | 'Grau II' | 'Grau III' | null {
  if (label === 'Grau I' || label === 'Grau II' || label === 'Grau III') return label;
  return null;
}

function getRdcGrade(input: AgaRdcComparisonInput): 'Grau I' | 'Grau II' | 'Grau III' | null {
  return parseGrauLabel(input.classificacao);
}

function getTrend(delta: number | null, higherIsBetter: boolean): AgaTrend {
  if (delta === null) return 'indisponivel';
  if (delta === 0) return 'estavel';
  return (higherIsBetter ? delta > 0 : delta < 0) ? 'melhora' : 'piora';
}

export function compararAvaliacoes(atual: AgaComparisonInput, anterior: AgaComparisonInput): AgaComparisonResult {
  const escalas = SCALE_DEFINITIONS.map((definition) => {
    const atualValue = atual[definition.field] ?? null;
    const anteriorValue = anterior[definition.field] ?? null;
    const delta = atualValue !== null && anteriorValue !== null ? atualValue - anteriorValue : null;

    return {
      escala: definition.escala,
      label: definition.label,
      unidade: definition.unidade,
      anterior: anteriorValue,
      atual: atualValue,
      delta,
      tendencia: getTrend(delta, definition.higherIsBetter),
      higherIsBetter: definition.higherIsBetter,
    };
  });

  return {
    escalas,
    resumo: {
      melhoras: escalas.filter((escala) => escala.tendencia === 'melhora').length,
      estaveis: escalas.filter((escala) => escala.tendencia === 'estavel').length,
      pontosDeAtencao: escalas.filter((escala) => escala.tendencia === 'piora').length,
    },
  };
}
