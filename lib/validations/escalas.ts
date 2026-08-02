import { z } from 'zod';
import { agaAnswersSchema, calcularAgaScores, type AgaAnswers } from './aga-form';

// Schema para criação de AGA — preenchida EXCLUSIVAMENTE pelo formulário de
// múltipla escolha (agaAnswersSchema). Os escores são derivados no servidor
// por calcularAgaScores; campos de escore manual NÃO são aceitos
// (strictObject rejeita qualquer chave fora do schema).
export const criarAvaliacaoSchema = z.strictObject({
  pacienteId: z.string().uuid(),
  dataAvaliacao: z.coerce.date().optional(),
  respostas: agaAnswersSchema,
  comorbidades: z.array(z.string().max(200)).max(50).optional(),
  medicamentos: z.array(
    z.object({
      nome: z.string().min(1).max(200),
      dose: z.string().min(1).max(100),
      frequencia: z.string().min(1).max(100),
    })
  ).max(50).optional(),
  suporteSocial: z.string().max(1000).optional(),
  moradia: z.string().max(500).optional(),
  observacoes: z.string().max(5000).optional(),
});

export { agaAnswersSchema, calcularAgaScores };
export type { AgaAnswers };

// Schema para sinais vitais
export const sinalVitalSchema = z.object({
  pacienteId: z.string().uuid(),
  dataAfericao: z.coerce.date().optional(),
  pressaoArterialSistolica: z.number().int().min(50).max(300).optional(),
  pressaoArterialDiastolica: z.number().int().min(20).max(200).optional(),
  frequenciaCardiaca: z.number().int().min(20).max(300).optional(),
  frequenciaRespiratoria: z.number().int().min(5).max(60).optional(),
  temperatura: z.number().int().min(300).max(450).optional(), // em décimos: 300=30°C, 450=45°C
  saturacaoO2: z.number().int().min(0).max(100).optional(),
  glicemia: z.number().int().min(20).max(800).optional(),
  peso: z.number().int().min(500).max(300000).optional(), // em gramas: 500g a 300kg
  altura: z.number().int().min(30).max(250).optional(), // em cm
  observacoes: z.string().max(1000).optional(),
});

// Interpretação automática das escalas
export function interpretarEscala(nome: string, score: number | null | undefined): string | null {
  if (score === null || score === undefined) return null;

  switch (nome) {
    case 'katz':
      if (score === 0) return 'Independente em ABVD';
      if (score === 6) return 'Dependência em todas as ABVD';
      return `Dependência em ${score} de 6 ABVD`;
    case 'lawton':
      if (score === 0) return 'Dependência em AIVD';
      if (score === 8) return 'Independência em AIVD';
      return `Necessita de assistência em ${8 - score} de 8 AIVD`;
    case 'meem':
      if (score >= 24) return 'Normal';
      if (score >= 18) return 'Déficit cognitivo leve';
      return 'Déficit cognitivo moderado a grave';
    case 'gds15':
      if (score <= 5) return 'Sem depressão';
      if (score <= 10) return 'Depressão leve';
      return 'Depressão severa';
    case 'man':
      if (score >= 12) return 'Nutrição adequada';
      if (score >= 8) return 'Risco de desnutrição';
      return 'Desnutrição';
    case 'tug':
      if (score < 10) return 'Mobilidade normal';
      if (score < 20) return 'Risco de queda';
      return 'Alto risco de queda';
    default:
      return null;
  }
}

export type Rdc502Autocuidado = 'nenhuma' | 'ate_tres' | 'todas';
export type Rdc502Cognicao = 'sem_comprometimento' | 'alteracao_controlada' | 'comprometimento';

export type GrauDependenciaAnvisa = {
  grau: 'I' | 'II' | 'III';
  label: 'Grau I' | 'Grau II' | 'Grau III';
  tone: 'ok' | 'warn' | 'risk';
  fundamento: string;
};

// A RDC 502/2021 não transforma Katz ou Lawton em um grau. Para ILPI, o grau
// depende do autocuidado e do comprometimento cognitivo informados na avaliação.
export function classificarGrauDependenciaRdc502(
  autocuidado: Rdc502Autocuidado | null | undefined,
  cognicao: Rdc502Cognicao | null | undefined,
): GrauDependenciaAnvisa | null {
  if (!autocuidado || !cognicao) return null;

  if (autocuidado === 'todas' || cognicao === 'comprometimento') {
    return {
      grau: 'III',
      label: 'Grau III',
      tone: 'risk',
      fundamento: 'Assistência em todas as atividades de autocuidado e/ou comprometimento cognitivo.',
    };
  }

  if (autocuidado === 'ate_tres') {
    return {
      grau: 'II',
      label: 'Grau II',
      tone: 'warn',
      fundamento: 'Dependência em até três atividades de autocuidado, sem comprometimento cognitivo não controlado.',
    };
  }

  return {
    grau: 'I',
    label: 'Grau I',
    tone: 'ok',
    fundamento: 'Pessoa idosa independente, ainda que utilize equipamentos de autoajuda.',
  };
}
