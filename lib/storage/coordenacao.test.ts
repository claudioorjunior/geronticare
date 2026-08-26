import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Db } from '@/lib/db';

const mocks = vi.hoisted(() => ({
  bloquearChavesAnexo: vi.fn(),
  objetoExiste: vi.fn(),
}));

vi.mock('./lock', () => ({
  bloquearChavesAnexo: mocks.bloquearChavesAnexo,
}));

vi.mock('./index', () => ({
  objetoExiste: mocks.objetoExiste,
}));

function criarDb({
  referenciaAtual = false,
  referenciaLegada = false,
}: {
  referenciaAtual?: boolean;
  referenciaLegada?: boolean;
} = {}) {
  const findAnexo = vi.fn(async () => referenciaAtual ? { id: 'anexo-1' } : null);
  const findRegistro = vi.fn(async () => referenciaLegada ? { id: 'registro-1' } : null);
  const tx = {
    query: {
      anexos: {
        findFirst: findAnexo,
      },
      registros: {
        findFirst: findRegistro,
      },
    },
  } as unknown as Db;
  const db = {
    transaction: vi.fn(async (callback: (transaction: Db) => Promise<unknown>) => callback(tx)),
  } as unknown as Db;
  return { db, tx, findAnexo, findRegistro };
}

describe('coordenação de anexos', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.objetoExiste.mockResolvedValue(true);
  });

  it('bloqueia todas as chaves e verifica apenas os objetos obrigatórios', async () => {
    const { db, tx } = criarDb();
    const persistir = vi.fn(async () => ({ id: 'registro-1' }));
    const { finalizarReferenciasAnexo } = await import('./coordenacao');

    await expect(finalizarReferenciasAnexo(
      db,
      {
        chavesBloqueadas: ['legado', 'novo'],
        chavesObrigatorias: ['novo'],
      },
      persistir,
    )).resolves.toEqual({ id: 'registro-1' });

    expect(mocks.bloquearChavesAnexo).toHaveBeenCalledWith(tx, ['legado', 'novo']);
    expect(mocks.objetoExiste).toHaveBeenCalledTimes(1);
    expect(mocks.objetoExiste).toHaveBeenCalledWith('novo');
    expect(persistir).toHaveBeenCalledWith(tx);
    expect(mocks.bloquearChavesAnexo.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.objetoExiste.mock.invocationCallOrder[0],
    );
    expect(mocks.objetoExiste.mock.invocationCallOrder[0]).toBeLessThan(
      persistir.mock.invocationCallOrder[0],
    );
  });

  it('não persiste referências quando um objeto obrigatório está ausente', async () => {
    const { db } = criarDb();
    const persistir = vi.fn();
    mocks.objetoExiste.mockResolvedValueOnce(false);
    const {
      finalizarReferenciasAnexo,
      ObjetosAnexoAusentesError,
    } = await import('./coordenacao');

    await expect(finalizarReferenciasAnexo(
      db,
      {
        chavesBloqueadas: ['ausente'],
        chavesObrigatorias: ['ausente'],
      },
      persistir,
    )).rejects.toEqual(new ObjetosAnexoAusentesError(['ausente']));
    expect(persistir).not.toHaveBeenCalled();
  });

  it('preserva o objeto quando existe uma referência atual', async () => {
    const { db, findRegistro } = criarDb({ referenciaAtual: true });
    const removerFisicamente = vi.fn();
    const { removerObjetoSeOrfao } = await import('./coordenacao');

    await expect(
      removerObjetoSeOrfao(db, 'chave', removerFisicamente),
    ).resolves.toBe('referenciado');
    expect(findRegistro).not.toHaveBeenCalled();
    expect(removerFisicamente).not.toHaveBeenCalled();
  });

  it('preserva o objeto quando existe uma referência legada', async () => {
    const { db } = criarDb({ referenciaLegada: true });
    const removerFisicamente = vi.fn();
    const { removerObjetoSeOrfao } = await import('./coordenacao');

    await expect(
      removerObjetoSeOrfao(db, 'chave', removerFisicamente),
    ).resolves.toBe('referenciado');
    expect(removerFisicamente).not.toHaveBeenCalled();
  });

  it('remove o objeto sem referência atual ou legada', async () => {
    const { db, findAnexo, findRegistro } = criarDb();
    const removerFisicamente = vi.fn();
    const { removerObjetoSeOrfao } = await import('./coordenacao');

    await expect(
      removerObjetoSeOrfao(db, 'chave', removerFisicamente),
    ).resolves.toBe('removido');
    expect(removerFisicamente).toHaveBeenCalledWith('chave');
    expect(mocks.bloquearChavesAnexo.mock.invocationCallOrder[0]).toBeLessThan(
      findAnexo.mock.invocationCallOrder[0],
    );
    expect(findAnexo.mock.invocationCallOrder[0]).toBeLessThan(
      findRegistro.mock.invocationCallOrder[0],
    );
    expect(findRegistro.mock.invocationCallOrder[0]).toBeLessThan(
      removerFisicamente.mock.invocationCallOrder[0],
    );
  });

  it('remove uma referência atual e preserva o objeto citado pelo legado', async () => {
    const { db, tx, findRegistro } = criarDb({ referenciaLegada: true });
    const removerReferencia = vi.fn();
    const removerFisicamente = vi.fn();
    const { removerReferenciaAnexo } = await import('./coordenacao');

    await expect(removerReferenciaAnexo(
      db,
      'chave',
      removerReferencia,
      removerFisicamente,
    )).resolves.toBe('referenciado');
    expect(removerReferencia).toHaveBeenCalledWith(tx);
    expect(removerFisicamente).not.toHaveBeenCalled();
    expect(removerReferencia.mock.invocationCallOrder[0]).toBeLessThan(
      findRegistro.mock.invocationCallOrder[0],
    );
  });
});
