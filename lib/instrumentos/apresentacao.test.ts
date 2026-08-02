import { describe, expect, it } from 'vitest';
import { formatarEspecialidade, formatarEscoreInstrumento } from '@/lib/instrumentos/apresentacao';

describe('apresentação de aplicações de instrumentos', () => {
  it('traduz as especialidades persistidas', () => {
    expect(formatarEspecialidade('terapia_ocupacional')).toBe('Terapia ocupacional');
    expect(formatarEspecialidade('nutricao')).toBe('Nutrição');
    expect(formatarEspecialidade(null)).toBe('Especialidade não informada');
  });

  it('apresenta escore com unidade quando aplicável', () => {
    expect(formatarEscoreInstrumento('meem', 27)).toBe('27 pontos');
    expect(formatarEscoreInstrumento('tug', 12)).toBe('12 segundos');
    expect(formatarEscoreInstrumento('rdc502', null)).toBe('Sem escore numérico');
  });
});
