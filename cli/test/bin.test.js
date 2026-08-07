import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const raiz = dirname(fileURLToPath(import.meta.url));
const bin = join(raiz, '..', 'bin', 'geronticare.js');

test('entrypoint não executa código legado depois do dispatch', () => {
  const resultado = spawnSync(process.execPath, [bin, 'comando-invalido'], { encoding: 'utf8' });
  const saida = `${resultado.stdout}${resultado.stderr}`;
  assert.equal(resultado.status, 2);
  assert.doesNotMatch(saida, /executarInstalacao is not defined/);
});
