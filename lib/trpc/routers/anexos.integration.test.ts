import { beforeAll, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import type { Db } from '@/lib/db';
import type { Context } from '../server';
import { anexos, registros, instituicoes } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { permissaoEfetiva } from '../autorizacao';

type Caller = ReturnType<import('@/lib/trpc/root').AppRouter['createCaller']>;

const INSTITUICAO = 'ae6c72cc-c72e-4b20-9686-7d015efe9b24';
const MEDICO = 'a49fa411-c9b2-48e5-98cf-a5f4fb1a9a23';
const LEITOR = 'b8a2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';
const PACIENTE = '7714cac2-1f53-4fd6-808d-0b87ea6bdf57';
const OUTRA_INSTITUICAO = 'c3702856-3c7e-4dc0-86cf-3f7aeef477c0';
const PACIENTE_EXTERNO = '171bbbd3-375d-44d2-aa80-e9be37b18e57';

function chaveValida(paciente = PACIENTE): string {
  return `instituicoes/${INSTITUICAO}/pacientes/${paciente}/` +
    `${randomUUID()}-exame.pdf`;
}

let caller: Caller;
let db!: Db;
let objetoExiste: ReturnType<typeof vi.spyOn>;

beforeAll(async () => {
  (process.env as { NODE_ENV?: string }).NODE_ENV = 'development';
  // Garante PGlite in-memory (schema migrado) mesmo com DATABASE_URL no
  // ambiente do shell — o teste de integração não deve depender de Postgres.
  delete (process.env as Record<string, string | undefined>).DATABASE_URL;
  const { getDb } = await import('@/lib/db');
  const { appRouter } = await import('@/lib/trpc/root');
  const storage = await import('@/lib/storage');
  db = await getDb<Db>();
  objetoExiste = vi.spyOn(storage, 'objetoExiste').mockResolvedValue(true);
  caller = appRouter.createCaller({
    db,
    session: null,
    headers: new Headers(),
    userId: MEDICO,
    instituicaoId: INSTITUICAO,
    userRole: 'profissional',
    permissoes: permissaoEfetiva('profissional'),
  } as unknown as Context);
});

describe('integração anexos (PGlite real) — v0.6.0', () => {
  it('registros.criar persiste metadados de anexos na mesma transação', async () => {
    const chave = chaveValida();
    const registro = await caller.registros.criar({
      pacienteId: PACIENTE,
      especialidade: 'medicina',
      tipo: 'exame',
      titulo: 'Exame com anexo',
      conteudo: 'Resultado de laboratório anexado.',
      anexosNovos: [
        { chave, nome: 'exame.pdf', tipo: 'application/pdf', tamanhoBytes: 4096 },
      ],
    });

    const anexosDoRegistro = await db.query.anexos.findMany({
      where: eq(anexos.registroId, registro.id),
    });

    expect(anexosDoRegistro).toHaveLength(1);
    expect(anexosDoRegistro[0]).toMatchObject({
      instituicaoId: INSTITUICAO,
      pacienteId: PACIENTE,
      registroId: registro.id,
      criadoPorId: MEDICO,
      chave,
      nome: 'exame.pdf',
      tipo: 'application/pdf',
      tamanhoBytes: 4096,
    });
  });

  it('registros.criar confere o objeto dentro da transação coordenada', async () => {
    const transaction = vi.spyOn(db, 'transaction');
    objetoExiste.mockClear();

    try {
      await caller.registros.criar({
        pacienteId: PACIENTE,
        especialidade: 'medicina',
        tipo: 'exame',
        titulo: 'Exame coordenado',
        conteudo: 'Finalização protegida contra limpeza concorrente.',
        anexosNovos: [
          { chave: chaveValida(), nome: 'coordenado.pdf', tipo: 'application/pdf', tamanhoBytes: 1024 },
        ],
      });

      expect(transaction).toHaveBeenCalledOnce();
      expect(transaction.mock.invocationCallOrder[0]).toBeLessThan(
        objetoExiste.mock.invocationCallOrder[0],
      );
    } finally {
      transaction.mockRestore();
    }
  });

  it('registros.criar persiste chave legada e coordena o lock com a transação', async () => {
    const transaction = vi.spyOn(db, 'transaction');
    const chaveLegada = chaveValida();

    try {
      const registro = await caller.registros.criar({
        pacienteId: PACIENTE,
        especialidade: 'medicina',
        tipo: 'exame',
        titulo: 'Exame com chave JSON legada',
        conteudo: 'Referência persistida em registros.anexos[].chave.',
        anexos: [
          { nome: 'legado.pdf', chave: chaveLegada, tipo: 'application/pdf' },
        ],
      });

      const persistido = await db.query.registros.findFirst({
        where: eq(registros.id, registro.id),
        columns: { anexos: true },
      });

      expect(persistido?.anexos).toEqual([
        { nome: 'legado.pdf', chave: chaveLegada, tipo: 'application/pdf' },
      ]);
      expect(transaction).toHaveBeenCalledOnce();
    } finally {
      transaction.mockRestore();
    }
  });

  it('registros.criar sem anexos funciona normalmente', async () => {
    const registro = await caller.registros.criar({
      pacienteId: PACIENTE,
      especialidade: 'medicina',
      tipo: 'evolucao',
      titulo: 'Evolução sem anexo',
      conteudo: 'Paciente estável.',
    });

    const anexosDoRegistro = await db.query.anexos.findMany({
      where: eq(anexos.registroId, registro.id),
    });
    expect(anexosDoRegistro).toHaveLength(0);
  });

  it('registros.criar rejeita anexosNovos quando o storage não está configurado', async () => {
    // O env é lido uma vez no import — mockar o módulo storage para simular
    // "desabilitado" sem depender de STORAGE_DRIVER.
    const storage = await import('@/lib/storage');
    const spy = vi.spyOn(storage, 'storageConfigurado').mockReturnValue(false);
    try {
      await expect(
        caller.registros.criar({
          pacienteId: PACIENTE,
          especialidade: 'medicina',
          tipo: 'exame',
          titulo: 'Exame com anexo',
          conteudo: 'Não deveria persistir metadado sem storage.',
          anexosNovos: [
            { chave: chaveValida(), nome: 'x.pdf', tipo: 'application/pdf', tamanhoBytes: 100 },
          ],
        }),
      ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    } finally {
      spy.mockRestore();
    }
  });

  it('registros.criar exige anexo:criar quando anexosNovos não está vazio', async () => {
    const semPermissaoAnexo = (await import('@/lib/trpc/root')).appRouter.createCaller({
      db,
      session: null,
      headers: new Headers(),
      userId: LEITOR,
      instituicaoId: INSTITUICAO,
      userRole: 'usuario',
      permissoes: ['clinico:ler', 'clinico:editar', 'anexo:ver'],
    } as unknown as Context);

    await expect(
      semPermissaoAnexo.registros.criar({
        pacienteId: PACIENTE,
        especialidade: 'medicina',
        tipo: 'exame',
        titulo: 'Exame sem permissão de anexo',
        conteudo: 'Não deve contornar o RBAC de documentos.',
        anexosNovos: [
          { chave: chaveValida(), nome: 'x.pdf', tipo: 'application/pdf', tamanhoBytes: 100 },
        ],
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('registros.criar rejeita metadados quando o objeto não existe no storage', async () => {
    objetoExiste.mockResolvedValue(false);
    try {
      await expect(
        caller.registros.criar({
          pacienteId: PACIENTE,
          especialidade: 'medicina',
          tipo: 'exame',
          titulo: 'Exame sem objeto',
          conteudo: 'O arquivo ainda não existe.',
          anexosNovos: [
            { chave: chaveValida(), nome: 'x.pdf', tipo: 'application/pdf', tamanhoBytes: 100 },
          ],
        }),
      ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    } finally {
      objetoExiste.mockResolvedValue(true);
    }
  });

  it('rejeita chave de anexo de outro paciente/instituição (fail-closed)', async () => {
    await expect(
      caller.registros.criar({
        pacienteId: PACIENTE,
        especialidade: 'medicina',
        tipo: 'exame',
        titulo: 'Exame inválido',
        conteudo: 'Chave errada.',
        anexosNovos: [
          { chave: chaveValida('ce5c328b-0e95-4136-b354-8a577d7cb2e7'), nome: 'x.pdf', tipo: 'application/pdf', tamanhoBytes: 100 },
        ],
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });

    await expect(
      caller.registros.criar({
        pacienteId: PACIENTE,
        especialidade: 'medicina',
        tipo: 'exame',
        titulo: 'Exame inválido',
        conteudo: 'Chave de outra instituição.',
        anexosNovos: [
          {
            chave: `instituicoes/${OUTRA_INSTITUICAO}/pacientes/${PACIENTE}/` +
              '520471aa-5994-4886-9ee6-1cee8e7aa810-x.pdf',
            nome: 'x.pdf',
            tipo: 'application/pdf',
            tamanhoBytes: 100,
          },
        ],
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('anexos.listarPorPaciente retorna metadados com autor, filtrando por instituição', async () => {
    const registro = await caller.registros.criar({
      pacienteId: PACIENTE,
      especialidade: 'medicina',
      tipo: 'exame',
      titulo: 'Exame listável',
      conteudo: 'Conteúdo.',
      anexosNovos: [
        { chave: chaveValida(), nome: 'lista.pdf', tipo: 'application/pdf', tamanhoBytes: 2048 },
      ],
    });

    const lista = await caller.anexos.listarPorPaciente({ pacienteId: PACIENTE });

    expect(lista.length).toBeGreaterThanOrEqual(1);
    const anexo = lista.find((a) => a.registroId === registro.id);
    expect(anexo).toMatchObject({
      nome: 'lista.pdf',
      tipo: 'application/pdf',
      tamanhoBytes: 2048,
      criadoPorNome: 'Dr. Mock',
    });
  });

  it('não expõe anexos de paciente de outra instituição', async () => {
    await db.insert(instituicoes).values({ id: OUTRA_INSTITUICAO, nome: 'ILPI Externa Anexos' });
    // paciente externo da instituição OUTRA_INSTITUICAO
    await db.insert(await import('@/lib/db/schema').then((s) => s.pacientes)).values({
      id: PACIENTE_EXTERNO,
      instituicaoId: OUTRA_INSTITUICAO,
      nome: 'Paciente Externo Anexos',
      dataNascimento: new Date('1940-01-01T00:00:00Z'),
      sexo: 'feminino',
      dataAdmissao: new Date('2026-01-01T00:00:00Z'),
    });

    await expect(
      caller.anexos.listarPorPaciente({ pacienteId: PACIENTE_EXTERNO }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('papel usuario (leitura) pode listar, mas não remover anexo', async () => {
    const leitorCaller = (await import('@/lib/trpc/root')).appRouter.createCaller({
      db,
      session: null,
      headers: new Headers(),
      userId: LEITOR,
      instituicaoId: INSTITUICAO,
      userRole: 'usuario',
      permissoes: permissaoEfetiva('usuario'),
    } as unknown as Context);

    // um anexo existente
    const existente = await db.query.anexos.findFirst({
      where: eq(anexos.pacienteId, PACIENTE),
      columns: { id: true },
    });
    expect(existente).toBeTruthy();

    const lista = await leitorCaller.anexos.listarPorPaciente({ pacienteId: PACIENTE });
    expect(Array.isArray(lista)).toBe(true);

    await expect(
      leitorCaller.anexos.remover({ id: existente!.id }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('remover anexo apaga metadados (objeto storage é best-effort)', async () => {
    const chave = chaveValida();
    const registro = await caller.registros.criar({
      pacienteId: PACIENTE,
      especialidade: 'medicina',
      tipo: 'exame',
      titulo: 'Exame removível',
      conteudo: 'Conteúdo.',
      anexosNovos: [
        { chave, nome: 'remover.pdf', tipo: 'application/pdf', tamanhoBytes: 1024 },
      ],
    });

    const anexo = await db.query.anexos.findFirst({
      where: eq(anexos.registroId, registro.id),
      columns: { id: true },
    });

    await caller.anexos.remover({ id: anexo!.id });

    const restante = await db.query.anexos.findFirst({
      where: eq(anexos.id, anexo!.id),
    });
    expect(restante).toBeUndefined();
  });

  it('remover registro remove anexos via CASCADE', async () => {
    const registro = await caller.registros.criar({
      pacienteId: PACIENTE,
      especialidade: 'medicina',
      tipo: 'exame',
      titulo: 'Exame cascade',
      conteudo: 'Conteúdo.',
      anexosNovos: [
        { chave: chaveValida(), nome: 'cascade.pdf', tipo: 'application/pdf', tamanhoBytes: 1024 },
      ],
    });

    await db.delete(registros).where(eq(registros.id, registro.id));

    const restante = await db.query.anexos.findMany({
      where: eq(anexos.registroId, registro.id),
    });
    expect(restante).toHaveLength(0);
  });

  it('anexos.criar confere o objeto dentro da transação coordenada', async () => {
    const transaction = vi.spyOn(db, 'transaction');
    objetoExiste.mockClear();

    try {
      await caller.anexos.criar({
        pacienteId: PACIENTE,
        chave: chaveValida(),
        nome: 'avulso-coordenado.pdf',
        tipo: 'application/pdf',
        tamanhoBytes: 2048,
      });

      expect(transaction).toHaveBeenCalledOnce();
      expect(transaction.mock.invocationCallOrder[0]).toBeLessThan(
        objetoExiste.mock.invocationCallOrder[0],
      );
    } finally {
      transaction.mockRestore();
    }
  });

  it('anexos.criar persiste documento avulso (sem registro)', async () => {
    const chave = chaveValida();
    const criado = await caller.anexos.criar({
      pacienteId: PACIENTE,
      chave,
      nome: 'avulso.pdf',
      tipo: 'application/pdf',
      tamanhoBytes: 2048,
    });

    const noBanco = await db.query.anexos.findFirst({ where: eq(anexos.id, criado.id) });
    expect(noBanco).toMatchObject({
      instituicaoId: INSTITUICAO,
      pacienteId: PACIENTE,
      registroId: null,
      criadoPorId: MEDICO,
      chave,
      nome: 'avulso.pdf',
    });
  });

  it('anexos.criar rejeita metadados quando o storage não está configurado', async () => {
    const storage = await import('@/lib/storage');
    const spy = vi.spyOn(storage, 'storageConfigurado').mockReturnValue(false);
    try {
      await expect(
        caller.anexos.criar({
          pacienteId: PACIENTE,
          chave: chaveValida(),
          nome: 'fantasma.pdf',
          tipo: 'application/pdf',
          tamanhoBytes: 2048,
        }),
      ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    } finally {
      spy.mockRestore();
    }
  });

  it('anexos.criar rejeita metadados quando o objeto não existe no storage', async () => {
    objetoExiste.mockResolvedValue(false);
    try {
      await expect(
        caller.anexos.criar({
          pacienteId: PACIENTE,
          chave: chaveValida(),
          nome: 'fantasma.pdf',
          tipo: 'application/pdf',
          tamanhoBytes: 2048,
        }),
      ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    } finally {
      objetoExiste.mockResolvedValue(true);
    }
  });

  it('anexos.criar rejeita chave de outro paciente/instituição', async () => {
    await expect(
      caller.anexos.criar({
        pacienteId: PACIENTE,
        chave: chaveValida('ce5c328b-0e95-4136-b354-8a577d7cb2e7'),
        nome: 'x.pdf',
        tipo: 'application/pdf',
        tamanhoBytes: 100,
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });

    await expect(
      caller.anexos.criar({
        pacienteId: PACIENTE,
        chave: `instituicoes/${OUTRA_INSTITUICAO}/pacientes/${PACIENTE}/` +
          '520471aa-5994-4886-9ee6-1cee8e7aa810-x.pdf',
        nome: 'x.pdf',
        tipo: 'application/pdf',
        tamanhoBytes: 100,
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('papel usuario (leitura) NÃO pode criar anexo avulso — só lê/baixa', async () => {
    const leitorCaller = (await import('@/lib/trpc/root')).appRouter.createCaller({
      db,
      session: null,
      headers: new Headers(),
      userId: LEITOR,
      instituicaoId: INSTITUICAO,
      userRole: 'usuario',
      permissoes: permissaoEfetiva('usuario'),
    } as unknown as Context);

    await expect(
      leitorCaller.anexos.criar({
        pacienteId: PACIENTE,
        chave: chaveValida(),
        nome: 'admin-doc.pdf',
        tipo: 'application/pdf',
        tamanhoBytes: 512,
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });

    // também NÃO pode remover (escrita clínica)
    await expect(
      leitorCaller.anexos.remover({ id: '520471aa-5994-4886-9ee6-1cee8e7aa810' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('remover anexo avulso funciona sem registro vinculado', async () => {
    const criado = await caller.anexos.criar({
      pacienteId: PACIENTE,
      chave: chaveValida(),
      nome: 'remover-avulso.pdf',
      tipo: 'application/pdf',
      tamanhoBytes: 1024,
    });

    await caller.anexos.remover({ id: criado.id });

    const restante = await db.query.anexos.findFirst({ where: eq(anexos.id, criado.id) });
    expect(restante).toBeUndefined();
  });
});
