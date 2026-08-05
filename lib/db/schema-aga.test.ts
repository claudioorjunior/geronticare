import { describe, expect, it } from 'vitest';
import { getTableName } from 'drizzle-orm';
import { agaAplicacoes, agas } from './schema';

describe('schema de consolidação AGA', () => {
  it('define aggregate e snapshot imutável com as restrições de identidade', () => {
    expect(getTableName(agas)).toBe('agas');
    expect(getTableName(agaAplicacoes)).toBe('aga_aplicacoes');
    expect(agas).toHaveProperty('status');
    expect(agas).toHaveProperty('concluidaPorId');
    expect(agaAplicacoes).toHaveProperty('respostas');
    expect(agaAplicacoes).toHaveProperty('versaoInstrumento');
    expect('updatedAt' in agaAplicacoes).toBe(false);
  });
});
