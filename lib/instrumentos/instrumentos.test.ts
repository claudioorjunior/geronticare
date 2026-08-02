import { describe, expect, it } from 'vitest';
import {
  INSTRUMENTO_SLUGS,
  evaluateInstrument,
  getInstrumentDefinition,
  isInstrumentoSlug,
} from '@/lib/instrumentos/instrumentos';

describe('registry de instrumentos', () => {
  it('expõe os sete instrumentos multiprofissionais', () => {
    expect(INSTRUMENTO_SLUGS).toEqual([
      'rdc502',
      'katz',
      'lawton',
      'meem',
      'gds15',
      'man',
      'tug',
    ]);
  });

  it('mantém metadata básica para cada instrumento', () => {
    for (const slug of INSTRUMENTO_SLUGS) {
      expect(getInstrumentDefinition(slug)).toMatchObject({
        slug,
        nome: expect.any(String),
        nomeCurto: expect.any(String),
        dominio: expect.any(String),
        descricao: expect.any(String),
        versao: expect.any(String),
      });
    }
  });

  it('valida slugs recebidos pelas rotas dinâmicas', () => {
    expect(isInstrumentoSlug('meem')).toBe(true);
    expect(isInstrumentoSlug('instrumento-inexistente')).toBe(false);
  });

  it('calcula Katz a partir das respostas, sem aceitar escore manual', () => {
    const result = evaluateInstrument('katz', {
      banho: 'independente',
      vestir: 'independente',
      banheiro: 'independente',
      transferencia: 'independente',
      continencia: 'controle_completo',
      alimentacao: 'independente',
    });

    expect(result).toMatchObject({
      escore: 0,
      classificacao: 'Independente em ABVD',
    });

    expect(() =>
      evaluateInstrument('katz', {
        banho: 'independente',
        vestir: 'independente',
        banheiro: 'independente',
        transferencia: 'independente',
        continencia: 'controle_completo',
        alimentacao: 'independente',
        escore: 99,
      }),
    ).toThrow();
  });

  it('calcula TUG e mantém sua unidade em segundos', () => {
    expect(evaluateInstrument('tug', { segundos: 12 })).toMatchObject({
      escore: 12,
      classificacao: 'Risco de queda',
    });
  });

  it('calcula classificação da RDC 502', () => {
    expect(
      evaluateInstrument('rdc502', {
        autocuidado: 'ate_tres',
        cognicao: 'sem_comprometimento',
      }),
    ).toMatchObject({
      escore: null,
      classificacao: 'Grau II',
      descricao: expect.stringContaining('Dependência em até três'),
    });
  });

  it('calcula Lawton aceitando somente opções conhecidas', () => {
    const respostas = {
      telefone: 'disca_numeros',
      compras: 'todas_sem_ajuda',
      refeicoes: 'planeja_prepara_serve',
      tarefas: 'sem_ajuda',
      lavanderia: 'sem_ajuda',
      transporte: 'publico_dirige',
      medicacao: 'doses_sem_ajuda',
      financas: 'administra',
    };

    expect(evaluateInstrument('lawton', respostas)).toMatchObject({
      escore: 8,
      classificacao: 'Independência em AIVD',
    });

    expect(() =>
      evaluateInstrument('lawton', {
        ...respostas,
        telefone: 'valor_digitado_livremente',
      }),
    ).toThrow();
  });

  it('calcula MEEM, GDS-15 e MAN com os cutoffs legados', () => {
    expect(
      evaluateInstrument('meem', {
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
      }),
    ).toMatchObject({ escore: 30, classificacao: 'Normal' });

    expect(
      evaluateInstrument('gds15', {
        q1: 'sim',
        q2: 'nao',
        q3: 'nao',
        q4: 'nao',
        q5: 'sim',
        q6: 'nao',
        q7: 'sim',
        q8: 'nao',
        q9: 'nao',
        q10: 'nao',
        q11: 'sim',
        q12: 'nao',
        q13: 'sim',
        q14: 'nao',
        q15: 'nao',
      }),
    ).toMatchObject({ escore: 0, classificacao: 'Sem depressão' });

    expect(
      evaluateInstrument('man', {
        ingesta: 2,
        perdaPeso: 3,
        mobilidade: 2,
        estresse: 2,
        neuropsicologico: 2,
        fonteAntropometrica: 'imc',
        imc: 3,
      }),
    ).toMatchObject({ escore: 14, classificacao: 'Nutrição adequada' });
  });

  it('rejeita respostas incompletas e campos calculados enviados pelo cliente', () => {
    expect(() => evaluateInstrument('meem', {})).toThrow();
    expect(() =>
      evaluateInstrument('tug', {
        segundos: 12,
        classificacao: 'Mobilidade normal',
      }),
    ).toThrow();
  });
});
