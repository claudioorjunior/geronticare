import { describe, expect, it } from 'vitest';
import { derivarGrauDependenciaRdc502 } from './escalas';

describe('derivarGrauDependenciaRdc502', () => {
  it('Grau I quando independente nas ABVD e cognição preservada', () => {
    const resultado = derivarGrauDependenciaRdc502({ katzScore: 0, meemScore: 27 });
    expect(resultado).toMatchObject({ grau: 'I', label: 'Grau I', tone: 'ok', requerConfirmacao: false });
    expect(resultado?.fundamento).toContain('Independente');
  });

  it('Grau II entre 1 e 3 dependências de ABVD', () => {
    expect(derivarGrauDependenciaRdc502({ katzScore: 3, meemScore: 25 })).toMatchObject({
      grau: 'II',
      label: 'Grau II',
      tone: 'warn',
      requerConfirmacao: false,
    });
  });

  it('Grau III com 4 ou mais dependências de ABVD mesmo com cognição preservada', () => {
    expect(derivarGrauDependenciaRdc502({ katzScore: 4, meemScore: 28 })).toMatchObject({
      grau: 'III',
      tone: 'risk',
      requerConfirmacao: false,
    });
  });

  it('MEEM abaixo do corte eleva para Grau III e exige confirmação clínica', () => {
    const resultado = derivarGrauDependenciaRdc502({ katzScore: 0, meemScore: 20 });
    expect(resultado).toMatchObject({ grau: 'III', tone: 'risk', requerConfirmacao: true });
    expect(resultado?.fundamento).toContain('MEEM 20/30');
  });

  it('cognição não avaliada mantém o grau funcional mas exige confirmação', () => {
    const resultado = derivarGrauDependenciaRdc502({ katzScore: 1 });
    expect(resultado).toMatchObject({ grau: 'II', requerConfirmacao: true });
    expect(resultado?.fundamento).toContain('Cognição não avaliada');
  });

  it('retorna null sem Katz válido (não há como derivar o grau)', () => {
    expect(derivarGrauDependenciaRdc502({ katzScore: null })).toBeNull();
    expect(derivarGrauDependenciaRdc502({ katzScore: undefined })).toBeNull();
    expect(derivarGrauDependenciaRdc502({ katzScore: 99 })).toBeNull();
    expect(derivarGrauDependenciaRdc502({ katzScore: -1 })).toBeNull();
  });
});
