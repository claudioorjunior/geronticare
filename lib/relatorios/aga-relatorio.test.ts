import { describe, expect, it } from 'vitest';
import { montarRelatorioAga, type AgaDetail } from './aga-relatorio';

function makeAga(overrides: Partial<AgaDetail> = {}): AgaDetail {
  const base: AgaDetail = {
    id: '22222222-2222-4222-8222-222222222222',
    pacienteId: '11111111-1111-4111-8111-111111111111',
    criadoPorId: '55555555-5555-4555-8555-555555555555',
    status: 'concluida',
    dataAvaliacao: new Date('2026-07-05T12:00:00Z'),
    observacoes: 'Paciente mantém acompanhamento multiprofissional.',
    resultado: 'Grau II',
    classificacao: 'Grau II',
    descricaoClassificacao: 'RDC 502/2021 — grau confirmado: Grau II.\nDerivado de: Dependência em 2 de 6 atividades de autocuidado (Katz). Rastreio cognitivo preservado (MEEM 30/30).',
    concluidaEm: new Date('2026-07-05T12:30:00Z'),
    concluidaPorId: '55555555-5555-4555-8555-555555555555',
    createdAt: new Date('2026-07-05T12:00:00Z'),
    updatedAt: new Date('2026-07-05T12:30:00Z'),
    concluidaPor: {
      id: '55555555-5555-4555-8555-555555555555',
      nome: 'Dra. Ana',
      especialidade: 'medicina',
      registroProfissional: 'CRM 123',
    },
    aplicacoes: [
      {
        id: '33333333-3333-4333-8333-333333333333',
        agaId: '22222222-2222-4222-8222-222222222222',
        aplicacaoInstrumentoId: '44444444-4444-4444-8444-444444444444',
        instrumento: 'meem',
        profissionalId: '55555555-5555-4555-8555-555555555555',
        registradoPorId: '55555555-5555-4555-8555-555555555555',
        dataAplicacao: new Date('2026-07-01T12:00:00Z'),
        respostas: { orientacao_temporal: 5, evocacao: 3 },
        escore: 30,
        classificacao: 'Normal',
        descricaoClassificacao: 'Normal',
        versaoInstrumento: '1.0',
        createdAt: new Date('2026-07-01T12:00:00Z'),
        profissional: { id: '55555555-5555-4555-8555-555555555555', nome: 'Dra. Ana', especialidade: 'medicina', registroProfissional: 'CRM 123' },
        registradoPor: { id: '55555555-5555-4555-8555-555555555555', nome: 'Dra. Ana' },
      },
      {
        id: '66666666-6666-4666-8666-666666666666',
        agaId: '22222222-2222-4222-8222-222222222222',
        aplicacaoInstrumentoId: '77777777-7777-4777-8777-777777777777',
        instrumento: 'katz',
        profissionalId: '55555555-5555-4555-8555-555555555555',
        registradoPorId: '55555555-5555-4555-8555-555555555555',
        dataAplicacao: new Date('2026-07-02T12:00:00Z'),
        respostas: { banho: 'assistido' },
        escore: 2,
        classificacao: 'Dependência em 2 de 6 ABVD',
        descricaoClassificacao: 'Dependência em 2 de 6 ABVD',
        versaoInstrumento: '1.0',
        createdAt: new Date('2026-07-02T12:00:00Z'),
        profissional: { id: '55555555-5555-4555-8555-555555555555', nome: 'Dra. Ana', especialidade: 'medicina', registroProfissional: 'CRM 123' },
        registradoPor: { id: '55555555-5555-4555-8555-555555555555', nome: 'Dra. Ana' },
      },
    ],
  };
  return { ...base, ...overrides };
}

describe('montarRelatorioAga', () => {
  it('maps the confirmed RDC 502 grade, concluded-by professional and observations', () => {
    const relatorio = montarRelatorioAga(makeAga());

    expect(relatorio.dataAvaliacao).toEqual(new Date('2026-07-05T12:00:00Z'));
    expect(relatorio.profissional).toBe('Dra. Ana');
    expect(relatorio.especialidade).toBe('medicina');
    expect(relatorio.classificacao).toBe('Grau II');
    expect(relatorio.fundamentoClassificacao).toContain('RDC 502/2021');
    expect(relatorio.observacoes).toBe('Paciente mantém acompanhamento multiprofissional.');
  });

  it('derives scale scores and interpretations from the snapshot applications', () => {
    const relatorio = montarRelatorioAga(makeAga());

    expect(relatorio.escalas).toEqual([
      expect.objectContaining({ key: 'katz', score: 2, interpretation: 'Dependência em 2 de 6 ABVD', max: 6 }),
      expect.objectContaining({ key: 'lawton', score: null, interpretation: null, max: 8 }),
      expect.objectContaining({ key: 'meem', score: 30, interpretation: 'Normal', max: 30 }),
      expect.objectContaining({ key: 'gds15', score: null, interpretation: null, max: 15 }),
      expect.objectContaining({ key: 'man', score: null, interpretation: null, max: 14 }),
      expect.objectContaining({ key: 'tug', score: null, interpretation: null, unit: 'segundos' }),
    ]);
  });

  it('keeps the free-text clinical sections empty because the new model has none', () => {
    const relatorio = montarRelatorioAga(makeAga());

    expect(relatorio.comorbidades).toEqual([]);
    expect(relatorio.medicamentos).toEqual([]);
    expect(relatorio.suporteSocial).toBeNull();
    expect(relatorio.moradia).toBeNull();
  });

  it('exposes null classification when the AGA has no confirmed grade', () => {
    const semGrau = makeAga({ classificacao: null, descricaoClassificacao: null });
    const relatorio = montarRelatorioAga(semGrau);
    expect(relatorio.classificacao).toBeNull();
    expect(relatorio.fundamentoClassificacao).toBeNull();
  });

  it('shows no professional when the AGA was not concluded', () => {
    const rascunho = makeAga({ status: 'rascunho', concluidaPor: null });
    const relatorio = montarRelatorioAga(rascunho);
    expect(relatorio.profissional).toBeNull();
    expect(relatorio.especialidade).toBeNull();
  });
});
