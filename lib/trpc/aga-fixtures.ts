import type { AgaAnswers } from '@/lib/validations/aga-form';

/**
 * Fixture de testes: respostas válidas do formulário AGA (todas as escalas
 * preenchidas). Compartilhada entre autorizacao.test.ts e dtos.test.ts.
 */
export const RESPOSTAS_VALIDAS: AgaAnswers = {
  rdc502: { autocuidado: 'nenhuma', cognicao: 'sem_comprometimento' },
  katz: {
    banho: 'independente',
    vestir: 'independente',
    banheiro: 'independente',
    transferencia: 'independente',
    continencia: 'controle_completo',
    alimentacao: 'independente',
  },
  lawton: {
    telefone: 'disca_numeros',
    compras: 'todas_sem_ajuda',
    refeicoes: 'planeja_prepara_serve',
    tarefas: 'sem_ajuda',
    lavanderia: 'sem_ajuda',
    transporte: 'publico_dirige',
    medicacao: 'doses_sem_ajuda',
    financas: 'administra',
  },
  meem: {
    escolaridadeAnos: 8,
    orientacao_temporal: 5,
    orientacao_espacial: 5,
    registro: 3,
    atencao_calculo: 5,
    evocacao: 3,
    nomeacao: 2,
    repeticao: 1,
    comando: 3,
    leitura: 1,
    escrita: 1,
    copia: 1,
  },
  gds15: {
    q1: 'sim', q2: 'nao', q3: 'nao', q4: 'nao', q5: 'sim',
    q6: 'nao', q7: 'sim', q8: 'nao', q9: 'nao', q10: 'nao',
    q11: 'sim', q12: 'nao', q13: 'sim', q14: 'nao', q15: 'nao',
  },
  man: {
    ingesta: 2,
    perdaPeso: 0,
    mobilidade: 2,
    estresse: 2,
    neuropsicologico: 2,
    fonteAntropometrica: 'imc',
    imc: 3,
  },
  tug: { segundos: 8 },
};
