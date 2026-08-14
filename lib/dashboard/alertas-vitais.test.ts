import { describe, expect, it } from 'vitest';
import { alertasDeSinais, classificarSinalVital } from './alertas-vitais';

const base = {
  pressaoArterialSistolica: null,
  pressaoArterialDiastolica: null,
  saturacaoO2: null,
  temperatura: null,
  glicemia: null,
};

describe('classificarSinalVital', () => {
  it('marca SpO2 < 90 como crítico', () => {
    expect(classificarSinalVital({ ...base, saturacaoO2: 88 })).toEqual({
      sinal: 'SpO2 88%',
      severidade: 'critico',
    });
  });

  it('converte temperatura em décimos antes do corte', () => {
    expect(classificarSinalVital({ ...base, temperatura: 386 })).toEqual({
      sinal: 'Temp 38.6 °C',
      severidade: 'atencao',
    });
    expect(classificarSinalVital({ ...base, temperatura: 365 })).toBeNull();
  });
});

describe('alertasDeSinais', () => {
  it('descarta pacientes sem alerta', () => {
    const alertas = alertasDeSinais([
      { pacienteNome: 'Ana', ...base, saturacaoO2: 97 },
      { pacienteNome: 'Bia', ...base, glicemia: 240 },
    ]);
    expect(alertas).toEqual([
      { pacienteNome: 'Bia', sinal: 'Glicemia 240 mg/dL', severidade: 'atencao' },
    ]);
  });
});
