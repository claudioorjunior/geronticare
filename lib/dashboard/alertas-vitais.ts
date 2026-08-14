export type SinalVitalAlerta = {
  pacienteNome: string;
  pressaoArterialSistolica: number | null;
  pressaoArterialDiastolica: number | null;
  saturacaoO2: number | null;
  temperatura: number | null;
  glicemia: number | null;
};

export type AlertaVital = {
  pacienteNome: string;
  sinal: string;
  severidade: 'critico' | 'atencao';
};

/**
 * Cortes fixos de triagem — não são protocolo clínico configurável.
 * Só o último sinal de cada paciente entra aqui.
 */
export function classificarSinalVital(
  s: Omit<SinalVitalAlerta, 'pacienteNome'>,
): { sinal: string; severidade: 'critico' | 'atencao' } | null {
  if (s.saturacaoO2 != null && s.saturacaoO2 < 90) {
    return { sinal: `SpO2 ${s.saturacaoO2}%`, severidade: 'critico' };
  }
  if (s.pressaoArterialSistolica != null && s.pressaoArterialSistolica >= 170) {
    const diastolica = s.pressaoArterialDiastolica ?? 0;
    return { sinal: `PA ${s.pressaoArterialSistolica}/${diastolica} mmHg`, severidade: 'critico' };
  }
  if (s.temperatura != null && s.temperatura / 10 >= 38.5) {
    return { sinal: `Temp ${(s.temperatura / 10).toFixed(1)} °C`, severidade: 'atencao' };
  }
  if (s.glicemia != null && s.glicemia >= 200) {
    return { sinal: `Glicemia ${s.glicemia} mg/dL`, severidade: 'atencao' };
  }
  return null;
}

export function alertasDeSinais(sinais: SinalVitalAlerta[]): AlertaVital[] {
  return sinais.flatMap((sinal) => {
    const cls = classificarSinalVital(sinal);
    return cls ? [{ pacienteNome: sinal.pacienteNome, ...cls }] : [];
  });
}
