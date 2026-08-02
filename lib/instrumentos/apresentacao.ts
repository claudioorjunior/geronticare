import type { InstrumentoSlug } from './instrumentos';

const especialidadeLabels: Record<string, string> = {
  medicina: 'Medicina',
  enfermagem: 'Enfermagem',
  fisioterapia: 'Fisioterapia',
  terapia_ocupacional: 'Terapia ocupacional',
  fonoaudiologia: 'Fonoaudiologia',
  nutricao: 'Nutrição',
  psicologia: 'Psicologia',
  servico_social: 'Serviço social',
};

export function formatarEspecialidade(
  especialidade?: string | null,
): string {
  if (!especialidade) return 'Especialidade não informada';
  return especialidadeLabels[especialidade] ?? especialidade;
}

export function formatarEscoreInstrumento(
  instrumento: InstrumentoSlug,
  escore: number | null,
): string {
  if (escore === null) return 'Sem escore numérico';
  if (instrumento === 'tug') return `${escore} segundos`;
  return `${escore} ${escore === 1 ? 'ponto' : 'pontos'}`;
}
