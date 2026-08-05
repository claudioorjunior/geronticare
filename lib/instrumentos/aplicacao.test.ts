import { describe, expect, it } from 'vitest';
import { parseAplicacaoInstrumentoInput } from '@/lib/instrumentos/aplicacao';

const PACIENTE_ID = '1b2a3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';
const PROFISSIONAL_ID = 'dddddddd-4444-4444-8444-444444444444';
const AGORA = new Date('2026-08-02T15:00:00.000Z');

const KATZ_INDEPENDENTE = {
  banho: 'independente',
  vestir: 'independente',
  banheiro: 'independente',
  transferencia: 'independente',
  continencia: 'controle_completo',
  alimentacao: 'independente',
};

describe('aplicação de instrumento', () => {
  it('valida o payload e deriva o resultado sem confiar no cliente', () => {
    expect(
      parseAplicacaoInstrumentoInput(
        {
          pacienteId: PACIENTE_ID,
          instrumento: 'katz',
          profissionalId: PROFISSIONAL_ID,
          dataAplicacao: new Date('2026-08-01T12:00:00.000Z'),
          respostas: KATZ_INDEPENDENTE,
        },
        AGORA,
      ),
    ).toMatchObject({
      pacienteId: PACIENTE_ID,
      instrumento: 'katz',
      profissionalId: PROFISSIONAL_ID,
      resultado: {
        escore: 0,
        classificacao: 'Independente em ABVD',
      },
      versaoInstrumento: expect.any(String),
    });
  });

  it('exige data de aplicação e profissional', () => {
    expect(() =>
      parseAplicacaoInstrumentoInput(
        {
          pacienteId: PACIENTE_ID,
          instrumento: 'katz',
          respostas: KATZ_INDEPENDENTE,
        },
        AGORA,
      ),
    ).toThrow();
  });

  it('rejeita data futura', () => {
    expect(() =>
      parseAplicacaoInstrumentoInput(
        {
          pacienteId: PACIENTE_ID,
          instrumento: 'katz',
          profissionalId: PROFISSIONAL_ID,
          dataAplicacao: new Date('2026-08-03T12:00:00.000Z'),
          respostas: KATZ_INDEPENDENTE,
        },
        AGORA,
      ),
    ).toThrow('A data da aplicação não pode estar no futuro.');
  });

  it('rejeita escore e classificação enviados manualmente', () => {
    expect(() =>
      parseAplicacaoInstrumentoInput(
        {
          pacienteId: PACIENTE_ID,
          instrumento: 'katz',
          profissionalId: PROFISSIONAL_ID,
          dataAplicacao: new Date('2026-08-01T12:00:00.000Z'),
          respostas: KATZ_INDEPENDENTE,
          escore: 99,
          classificacao: 'Independente em ABVD',
        },
        AGORA,
      ),
    ).toThrow();
  });
});
