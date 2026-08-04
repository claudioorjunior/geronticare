import { describe, expect, it } from 'vitest';
import { INSTRUMENTO_SLUGS } from '@/lib/instrumentos/instrumentos';
import {
  createInstrumentDraft,
  formatInstrumentAnswer,
  getInstrumentFields,
  parseInstrumentDraft,
} from '@/lib/instrumentos/campos';

const MEEM_COMPLETO = {
  escolaridadeAnos: '',
  orientacao_temporal: '5',
  orientacao_espacial: '5',
  registro: '3',
  atencao_calculo: '5',
  evocacao: '3',
  nomeacao: '2',
  repeticao: '1',
  comando: '3',
  leitura: '1',
  escrita: '1',
  copia: '1',
};

describe('campos declarativos dos instrumentos', () => {
  it('declara os campos dos seis instrumentos sem formulários duplicados', () => {
    const quantidadesEsperadas = {
      katz: 6,
      lawton: 8,
      meem: 12,
      gds15: 15,
      man: 8,
      tug: 1,
    } as const;

    for (const slug of INSTRUMENTO_SLUGS) {
      const campos = getInstrumentFields(slug);
      expect(campos).toHaveLength(quantidadesEsperadas[slug]);
      expect(new Set(campos.map((campo) => campo.key)).size).toBe(campos.length);
    }
  });

  it('cria um rascunho vazio para todos os campos do instrumento', () => {
    expect(createInstrumentDraft('tug')).toEqual({ segundos: '' });
  });

  it('converte valores do formulário para números antes da validação clínica', () => {
    expect(parseInstrumentDraft('meem', MEEM_COMPLETO)).toEqual({
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
    });
  });

  it('persiste somente a antropometria selecionada na MAN', () => {
    const respostas = parseInstrumentDraft('man', {
      ingesta: '2',
      perdaPeso: '3',
      mobilidade: '2',
      estresse: '2',
      neuropsicologico: '2',
      fonteAntropometrica: 'panturrilha',
      imc: '1',
      panturrilha: '3',
    });

    expect(respostas).toMatchObject({
      fonteAntropometrica: 'panturrilha',
      panturrilha: 3,
    });
    expect(respostas).not.toHaveProperty('imc');
  });

  it('rejeita rascunhos incompletos pelo schema clínico do instrumento', () => {
    expect(() => parseInstrumentDraft('katz', createInstrumentDraft('katz'))).toThrow();
  });

  it('formata respostas persistidas com os rótulos humanos e unidades', () => {
    expect(formatInstrumentAnswer('meem', 'orientacao_temporal', 5)).toBe(
      '5 de 5 pontos',
    );
    expect(formatInstrumentAnswer('tug', 'segundos', 12)).toBe('12 segundos');
  });
});
