import { beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { eq } from 'drizzle-orm';
import { verifyPassword } from 'better-auth/crypto';
import type { Db } from '@/lib/db';
import * as schema from '@/lib/db/schema';
import { accounts, instituicoes, usuarios } from '@/lib/db/schema';
import { concluirBootstrap, obterEstadoBootstrap } from './bootstrap';

let db!: Db;

beforeAll(async () => {
  const client = await PGlite.create();
  const migrationsDir = join(process.cwd(), 'lib', 'db', 'migrations');
  const journal = JSON.parse(
    readFileSync(join(migrationsDir, 'meta', '_journal.json'), 'utf8'),
  ) as { entries: Array<{ tag: string }> };

  for (const entry of journal.entries) {
    await client.exec(readFileSync(join(migrationsDir, `${entry.tag}.sql`), 'utf8'));
  }

  db = drizzle(client, { schema }) as unknown as Db;
});

describe('bootstrap integration with an empty migrated database', () => {
  it('creates the first institution and credential admin, then closes permanently', async () => {
    await expect(obterEstadoBootstrap(db)).resolves.toEqual({ necessario: true });

    const result = await concluirBootstrap(db, {
      instituicao: { nome: 'Lar Integração' },
      admin: {
        nome: 'Admin Integração',
        email: 'admin@integracao.test',
        senha: 'senha-segura-123',
      },
    });

    const instituicao = await db.query.instituicoes.findFirst({
      where: eq(instituicoes.id, result.instituicaoId),
    });
    const admin = await db.query.usuarios.findFirst({
      where: eq(usuarios.id, result.usuarioId),
    });
    const account = await db.query.accounts.findFirst({
      where: eq(accounts.userId, result.usuarioId),
    });

    expect(instituicao?.nome).toBe('Lar Integração');
    expect(admin).toMatchObject({
      nome: 'Admin Integração',
      email: 'admin@integracao.test',
      role: 'admin',
      ativo: true,
    });
    expect(account).toMatchObject({
      providerId: 'credential',
      accountId: result.usuarioId,
    });
    await expect(
      verifyPassword({ hash: account?.password ?? '', password: 'senha-segura-123' }),
    ).resolves.toBe(true);
    await expect(obterEstadoBootstrap(db)).resolves.toEqual({ necessario: false });
    await expect(
      concluirBootstrap(db, {
        instituicao: { nome: 'Segunda ILPI' },
        admin: {
          nome: 'Outro Admin',
          email: 'outro@integracao.test',
          senha: 'outra-senha-123',
        },
      }),
    ).rejects.toMatchObject({ code: 'BOOTSTRAP_INDISPONIVEL' });
  });
});
