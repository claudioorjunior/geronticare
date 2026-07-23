import { z } from 'zod';

// Schema para validação de escalas geriátricas
export const escalasGeriatricasSchema = z.object({
  katzScore: z.number().int().min(0).max(6).optional(),
  lawtonScore: z.number().int().min(0).max(8).optional(),
  meemScore: z.number().int().min(0).max(30).optional(),
  gds15Score: z.number().int().min(0).max(15).optional(),
  manScore: z.number().int().min(0).max(14).optional(),
  tugSegundos: z.number().int().min(0).max(300).optional(), // max ~5min, acima disso é erro de registro
});

// Schema para criação de AGA
export const criarAvaliacaoSchema = z.object({
  pacienteId: z.string().uuid(),
  dataAvaliacao: z.coerce.date().optional(),
  katzScore: z.number().int().min(0).max(6).optional(),
  lawtonScore: z.number().int().min(0).max(8).optional(),
  meemScore: z.number().int().min(0).max(30).optional(),
  gds15Score: z.number().int().min(0).max(15).optional(),
  manScore: z.number().int().min(0).max(14).optional(),
  tugSegundos: z.number().int().min(0).max(300).optional(),
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
      if (score === 6) return 'Independência total';
      if (score >= 3) return 'Dependência parcial';
      return 'Dependência total';
    case 'lawton':
      if (score === 8) return 'Independência total (AIVD)';
      if (score >= 4) return 'Dependência parcial (AIVD)';
      return 'Dependência total (AIVD)';
    case 'meem':
      if (score >= 24) return 'Normal';
      if (score >= 18) return 'Déficit cognitivo leve';
      return 'Déficit cognitivo moderado a grave';
    case 'gds15':
      if (score <= 5) return 'Sem depressão';
      if (score <= 9) return 'Depressão leve';
      return 'Depressão moderada a grave';
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
