import { describe, expect, it } from 'vitest';
import { compararAvaliacoes, compararClassificacaoRdc502 } from './aga-comparison';

describe('compararAvaliacoes', () => {
  it('classifica automaticamente melhora, piora e estabilidade respeitando a direção de cada escala', () => {
    const resultado = compararAvaliacoes(
      {
        katzScore: 2,
        lawtonScore: 7,
        meemScore: 25,
        gds15Score: 4,
        manScore: 10,
        tugSegundos: 12,
      },
      {
        katzScore: 4,
        lawtonScore: 5,
        meemScore: 23,
        gds15Score: 4,
        manScore: 8,
        tugSegundos: 17,
      },
    );

    expect(resultado.escalas).toEqual([
      expect.objectContaining({ escala: 'katz', tendencia: 'melhora', delta: -2 }),
      expect.objectContaining({ escala: 'lawton', tendencia: 'melhora', delta: 2 }),
      expect.objectContaining({ escala: 'meem', tendencia: 'melhora', delta: 2 }),
      expect.objectContaining({ escala: 'gds15', tendencia: 'estavel', delta: 0 }),
      expect.objectContaining({ escala: 'man', tendencia: 'melhora', delta: 2 }),
      expect.objectContaining({ escala: 'tug', tendencia: 'melhora', delta: -5 }),
    ]);
    expect(resultado.resumo).toEqual({ melhoras: 5, estaveis: 1, pontosDeAtencao: 0 });
  });

  it('não cria tendência quando um dos resultados não foi preenchido', () => {
    const resultado = compararAvaliacoes(
      { meemScore: null, tugSegundos: 20 },
      { meemScore: 24, tugSegundos: null },
    );

    expect(resultado.escalas.filter(({ escala }) => escala === 'meem' || escala === 'tug')).toEqual([
      expect.objectContaining({ escala: 'meem', tendencia: 'indisponivel', delta: null }),
      expect.objectContaining({ escala: 'tug', tendencia: 'indisponivel', delta: null }),
    ]);
    expect(resultado.resumo).toEqual({ melhoras: 0, estaveis: 0, pontosDeAtencao: 0 });
  });

  it('marca pioras como pontos de atenção sem transformar a comparação em diagnóstico', () => {
    const resultado = compararAvaliacoes(
      { gds15Score: 9, tugSegundos: 19 },
      { gds15Score: 4, tugSegundos: 12 },
    );

    expect(resultado.escalas.filter(({ escala }) => escala === 'gds15' || escala === 'tug')).toEqual([
      expect.objectContaining({ escala: 'gds15', tendencia: 'piora', delta: 5 }),
      expect.objectContaining({ escala: 'tug', tendencia: 'piora', delta: 7 }),
    ]);
    expect(resultado.resumo).toEqual({ melhoras: 0, estaveis: 0, pontosDeAtencao: 2 });
  });

  it('resume a evolução da classificação RDC sem criar diagnóstico', () => {
    expect(compararClassificacaoRdc502(
      { rdc502Autocuidado: 'ate_tres', rdc502Cognicao: 'alteracao_controlada' },
      { rdc502Autocuidado: 'todas', rdc502Cognicao: 'comprometimento' },
    )).toEqual(expect.objectContaining({
      anterior: 'Grau III',
      atual: 'Grau II',
      tendencia: 'melhora',
    }));
  });
});
