import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { comInstallLock, escreverEstado } from '../src/state.js';

async function rootTemporario(t) {
  const root = await mkdtemp(join(tmpdir(), 'geronticare-cli-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}

test('impede duas instalações concorrentes e libera o lock ao terminar', async (t) => {
  const root = await rootTemporario(t);
  let liberar;
  let iniciou;
  const iniciada = new Promise((resolve) => { iniciou = resolve; });
  const primeira = comInstallLock(
    root,
    () => new Promise((resolve) => {
      liberar = resolve;
      iniciou();
    }),
  );

  await iniciada;
  await assert.rejects(comInstallLock(root, async () => {}), /já está em execução/);
  liberar();
  await primeira;
  await assert.doesNotReject(comInstallLock(root, async () => {}));
});

test('recupera lock deixado por processo encerrado', async (t) => {
  const root = await rootTemporario(t);
  await writeFile(join(root, 'install.lock'), '999999999\n', { mode: 0o600 });

  await assert.doesNotReject(comInstallLock(root, async () => {}));
});

test('substitui install-state.json sem deixar arquivo temporário', async (t) => {
  const root = await rootTemporario(t);

  await escreverEstado(root, { fase: 'PREFLIGHT' });
  await escreverEstado(root, { fase: 'DATABASE_SELECTED' });

  assert.deepEqual(
    JSON.parse(await readFile(join(root, 'install-state.json'), 'utf8')),
    { fase: 'DATABASE_SELECTED' },
  );
  assert.deepEqual(await readdir(root), ['install-state.json']);
});
