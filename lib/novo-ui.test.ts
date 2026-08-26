import { describe, expect, it } from 'vitest';
import { novoUiAtivo } from './novo-ui';

describe('novoUiAtivo', () => {
  it('ativa o novo shell quando a variável não foi configurada', () => {
    expect(novoUiAtivo(undefined)).toBe(true);
  });

  it('permite rollback explícito para o shell legado', () => {
    expect(novoUiAtivo('false')).toBe(false);
  });

  it('mantém o novo shell com o valor documentado', () => {
    expect(novoUiAtivo('true')).toBe(true);
  });
});
