import { describe, expect, it } from 'vitest';
import { getTableName } from 'drizzle-orm';
import { aplicacoesInstrumentos } from './schema';

describe('schema de aplicações de instrumentos', () => {
  it('define um registro clínico imutável e auditável', () => {
    expect(getTableName(aplicacoesInstrumentos)).toBe(
      'aplicacoes_instrumentos',
    );
    expect(aplicacoesInstrumentos).toHaveProperty('pacienteId');
    expect(aplicacoesInstrumentos).toHaveProperty('instrumento');
    expect(aplicacoesInstrumentos).toHaveProperty('profissionalId');
    expect(aplicacoesInstrumentos).toHaveProperty('registradoPorId');
    expect(aplicacoesInstrumentos).toHaveProperty('dataAplicacao');
    expect(aplicacoesInstrumentos).toHaveProperty('respostas');
    expect(aplicacoesInstrumentos).toHaveProperty('escore');
    expect(aplicacoesInstrumentos).toHaveProperty('classificacao');
    expect(aplicacoesInstrumentos).toHaveProperty('descricaoClassificacao');
    expect(aplicacoesInstrumentos).toHaveProperty('versaoInstrumento');
    expect('updatedAt' in aplicacoesInstrumentos).toBe(false);
  });
});
