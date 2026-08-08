import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import test from 'node:test';

import { comandoNpm, parsearSha256, prepararRelease, validarListagem } from '../src/release.js';

const versao = '0.5.0';
const porta = 3000;
const baseUrl = `https://github.com/claudioorjunior/geronticare/releases/download/v${versao}`;
const urlTar = `${baseUrl}/geronticare-app-v${versao}.tar.gz`;
const urlSha = `${baseUrl}/geronticare-app-v${versao}.sha256`;

async function rootTemporario(t) {
  const root = await mkdtemp(join(tmpdir(), 'geronticare-release-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}

function fetchFake(porUrl) {
  return async (url) => ({
    ok: true,
    status: 200,
    body: Readable.from([porUrl[url]]),
  });
}

function spawnFake() {
  const chamadas = [];
  const spawnFn = async (args, opcoes = {}) => {
    chamadas.push({ args, opcoes });
    if (args[0] === 'tar' && args[1] === '-tzf') {
      return { exitCode: 0, stdout: 'pkg/\npkg/package.json\n' };
    }
    if (args[0] === 'tar' && args[1] === '-tvf') {
      return {
        exitCode: 0,
        stdout: 'drwxr-xr-x 0 0 0 0 Jan 1 1970 pkg/\n'
          + '-rw-r--r-- 0 0 0 0 Jan 1 1970 pkg/package.json\n',
      };
    }
    return { exitCode: 0, stdout: '', stderr: '' };
  };
  return { chamadas, spawnFn };
}

test('parseia o .sha256 nas formas "hex" e "hex  arquivo"', () => {
  assert.equal(parsearSha256('a1b2c3d4  geronticare-app-v0.5.0.tar.gz\n'), 'a1b2c3d4');
  assert.equal(parsearSha256('A1B2C3D4'), 'a1b2c3d4');
});

test('valida a listagem do tar contra nomes e tipos inseguros', () => {
  assert.doesNotThrow(() => validarListagem({
    nomes: ['pkg/', 'pkg/package.json'],
    tipos: ['d', '-'],
  }));
  for (const nome of ['', '../x', '/etc/passwd', 'a/../../b', 'pkg/\0x', '..\\arquivo']) {
    assert.throws(() => validarListagem({ nomes: [nome], tipos: ['-'] }), /inseguro/);
  }
  for (const tipo of ['l', 'h', '?']) {
    assert.throws(() => validarListagem({ nomes: ['pkg/x'], tipos: [tipo] }), /insegur/);
  }
  assert.throws(
    () => validarListagem({ nomes: ['C:\\evil'], tipos: ['-'], platform: 'win32' }),
    /inseguro/,
  );
  assert.throws(
    () => validarListagem({ nomes: ['\\\\server\\share\\evil'], tipos: ['-'], platform: 'win32' }),
    /inseguro/,
  );
});

test('checksum divergente lança erro e remove o staging', async (t) => {
  const root = await rootTemporario(t);
  const spawn = spawnFake();

  await assert.rejects(
    prepararRelease({
      root,
      versao,
      porta,
      fetchFn: fetchFake({
        [urlTar]: randomBytes(64),
        [urlSha]: Buffer.from('0000000000000000000000000000000000000000000000000000000000000000  arquivo.tar.gz\n'),
      }),
      spawnFn: spawn.spawnFn,
      log: () => {},
    }),
    /Checksum do pacote do GerontiCare não confere/,
  );

  assert.equal(spawn.chamadas.length, 0);
  assert.deepEqual(await readdir(root), ['staging']);
  assert.deepEqual(await readdir(join(root, 'staging')), []);
});

test('reutiliza release verificado sem rede nem spawn', async (t) => {
  const root = await rootTemporario(t);
  const releaseDir = join(root, 'releases', versao);
  await mkdir(releaseDir, { recursive: true });
  const conteudo = randomBytes(32);
  await writeFile(join(releaseDir, `geronticare-app-v${versao}.tar.gz`), conteudo);
  const sha256 = createHash('sha256').update(conteudo).digest('hex');
  await writeFile(
    join(releaseDir, 'verified.json'),
    `${JSON.stringify({ versao, sha256, nextPublicAppUrl: `http://127.0.0.1:${porta}` })}\n`,
  );

  const resultado = await prepararRelease({
    root,
    versao,
    porta,
    fetchFn: async () => { throw new Error('não deve baixar'); },
    spawnFn: async () => { throw new Error('não deve executar'); },
    log: () => {},
  });

  assert.deepEqual(resultado, { releaseDir, baixado: false });
});

test('baixa, valida, extrai, compila e promove o release', async (t) => {
  const root = await rootTemporario(t);
  const conteudo = randomBytes(64);
  const sha256 = createHash('sha256').update(conteudo).digest('hex');
  const spawn = spawnFake();

  const resultado = await prepararRelease({
    root,
    versao,
    porta,
    fetchFn: fetchFake({
      [urlTar]: conteudo,
      [urlSha]: Buffer.from(`${sha256}  geronticare-app-v${versao}.tar.gz\n`),
    }),
    spawnFn: spawn.spawnFn,
    log: () => {},
  });

  const releaseDir = join(root, 'releases', versao);
  assert.deepEqual(resultado, { releaseDir, baixado: true });
  assert.deepEqual(
    (await readdir(releaseDir)).sort(),
    [`geronticare-app-v${versao}.sha256`, `geronticare-app-v${versao}.tar.gz`, 'verified.json'],
  );
  assert.deepEqual(
    JSON.parse(await readFile(join(releaseDir, 'verified.json'), 'utf8')),
    { versao, arquivo: `geronticare-app-v${versao}.tar.gz`, sha256, nextPublicAppUrl: `http://127.0.0.1:${porta}` },
  );

  const build = spawn.chamadas.find((c) => c.args.includes('--webpack'));
  assert.ok(build);
  assert.equal(build.opcoes.env.NEXT_PUBLIC_APP_URL, `http://127.0.0.1:${porta}`);
  assert.ok(
    spawn.chamadas.some((c) => (
      (c.args[0] === 'npm' && c.args[1] === 'ci')
      || (c.args[0] === process.execPath && /npm-cli\.js$/.test(c.args[1] ?? '') && c.args[2] === 'ci')
    )),
  );
  assert.deepEqual(await readdir(join(root, 'staging')), []);
});

test('falha no build remove o staging e não promove', async (t) => {
  const root = await rootTemporario(t);
  const conteudo = randomBytes(64);
  const sha256 = createHash('sha256').update(conteudo).digest('hex');
  const chamadas = [];
  const spawnFn = async (args, opcoes = {}) => {
    chamadas.push({ args, opcoes });
    if (args[0] === 'tar' && args[1] === '-tzf') return { exitCode: 0, stdout: 'pkg/\n' };
    if (args[0] === 'tar' && args[1] === '-tvf') {
      return { exitCode: 0, stdout: 'drwxr-xr-x 0 0 0 0 Jan 1 1970 pkg/\n' };
    }
    if (args.includes('--webpack')) {
      return { exitCode: 1, stdout: '', stderr: 'ERRO: compilação falhou\n' };
    }
    return { exitCode: 0, stdout: '', stderr: '' };
  };

  await assert.rejects(
    prepararRelease({
      root,
      versao,
      porta,
      fetchFn: fetchFake({
        [urlTar]: conteudo,
        [urlSha]: Buffer.from(`${sha256}\n`),
      }),
      spawnFn,
      log: () => {},
    }),
    /Falha ao executar "npm build"/,
  );

  assert.deepEqual((await readdir(root)).sort(), ['downloads', 'staging']);
  assert.deepEqual(await readdir(join(root, 'staging')), []);
  assert.ok(await readFile(join(root, 'downloads', 'releases', versao, 'verified.json'), 'utf8'));
});

test('comandoNpm usa o Node no win32 e o npm no posix', async () => {
  const chamadas = [];
  const spawnFn = async (args, opcoes = {}) => {
    chamadas.push({ args, opcoes });
    return { exitCode: 0, stdout: '', stderr: '' };
  };

  await comandoNpm({ spawnFn, args: ['ci'], cwd: '/tmp', env: {}, platform: 'win32' });
  assert.equal(chamadas[0].args[0], process.execPath);
  assert.match(chamadas[0].args[1], /npm-cli\.js$/);
  assert.deepEqual(chamadas[0].args.slice(2), ['ci']);

  await comandoNpm({ spawnFn, args: ['run', 'build', '--', '--webpack'], cwd: '/tmp', env: {}, platform: 'darwin' });
  assert.deepEqual(chamadas[1].args, ['npm', 'run', 'build', '--', '--webpack']);
});
