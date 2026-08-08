import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { chmod, mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { executarDoctor } from '../src/doctor.js';

function clienteSimulado({ versao = '16.4', migrations = 5, falharEm = [] } = {}) {
  const cliente = (strings) => {
    const sql = strings.join('');
    if (falharEm.some((trecho) => sql.includes(trecho))) {
      throw new Error('erro simulado no banco');
    }
    if (sql.includes('server_version')) return [{ current_setting: versao }];
    if (sql.includes('__drizzle_migrations')) return [{ n: String(migrations) }];
    return [{ '?column?': 1 }];
  };
  cliente.end = async () => {};
  return cliente;
}

function base({ conectarPorta = async () => false, fetchFn = async () => ({ ok: false, status: 500 }), ...rest }) {
  return executarDoctor({
    criarCliente: () => clienteSimulado(),
    fetchFn,
    conectarPorta,
    log: () => {},
    ...rest,
  });
}

test('doctor reporta todos os checks ok em ambiente saudável', async () => {
  const root = await mkdtemp(join(tmpdir(), 'geronticare-doctor-ok-'));
  const versao = 'v1.0.0';
  const releaseDir = join(root, 'releases', versao);
  await mkdir(releaseDir, { recursive: true });
  const asset = Buffer.from('conteudo-da-release');
  await writeFile(join(releaseDir, 'geronticare.tar.gz'), asset);
  await writeFile(join(releaseDir, 'verified.json'), JSON.stringify({
    arquivo: 'geronticare.tar.gz',
    sha256: createHash('sha256').update(asset).digest('hex'),
  }));
  await writeFile(join(root, 'install-state.json'), JSON.stringify({ fase: 'READY', versao }));

  const linhas = [];
  const resultados = await executarDoctor({
    root,
    config: { porta: 3000, versao },
    segredos: {
      DATABASE_URL: 'postgresql://usuario:senhasecreta@localhost:5432/geronticare',
      SETUP_TOKEN: 'tok',
    },
    criarCliente: () => clienteSimulado(),
    fetchFn: async (url) => {
      if (url.endsWith('/api/health')) {
        return { ok: true, status: 200, json: async () => ({}) };
      }
      return { ok: true, status: 200, json: async () => ({ necessario: false }) };
    },
    conectarPorta: async () => true,
    log: (linha) => linhas.push(linha),
  });

  const porChave = Object.fromEntries(resultados.map((r) => [r.chave, r]));
  assert.equal(resultados.length, 10);
  assert.equal(porChave.lock.ok, true);
  assert.equal(porChave.estado.ok, true);
  assert.equal(porChave.estado.detalhe, 'fase READY');
  assert.equal(porChave.release.ok, true);
  assert.equal(porChave.porta.ok, true);
  assert.equal(porChave.processo.ok, true);
  assert.equal(porChave.banco.ok, true);
  assert.equal(porChave.versao.ok, true);
  assert.equal(porChave.migrations.ok, true);
  assert.equal(porChave.migrations.detalhe, '5 migrations aplicadas');
  assert.equal(porChave.bootstrap.ok, true);
  assert.equal(porChave.bootstrap.detalhe, 'necessario=false');
  assert.ok(!porChave.banco.detalhe.includes('senhasecreta'));
  assert.ok(porChave.banco.detalhe.includes('***'));
  assert.ok(linhas.every((linha) => /^\[(ok|FALHA)\] /.test(linha)));
});

test('doctor não lança quando arquivos não existem', async () => {
  const root = await mkdtemp(join(tmpdir(), 'geronticare-doctor-vazio-'));
  const resultados = await base({
    root,
    config: { porta: 3000, versao: 'v9.9.9' },
    segredos: {},
  });

  const porChave = Object.fromEntries(resultados.map((r) => [r.chave, r]));
  assert.equal(resultados.length, 10);
  assert.equal(porChave.lock.ok, true);
  assert.equal(porChave.estado.ok, false);
  assert.equal(porChave.release.ok, false);
  assert.equal(porChave.porta.ok, false);
  assert.equal(porChave.processo.ok, false);
  assert.equal(porChave.banco.ok, true);
  assert.equal(porChave.versao.ok, false);
  assert.equal(porChave.migrations.ok, false);
  assert.equal(porChave.bootstrap.ok, true);
});

test('doctor pula checks de porta quando não há config', async () => {
  const root = await mkdtemp(join(tmpdir(), 'geronticare-doctor-semposta-'));
  const resultados = await base({ root, config: {}, segredos: {} });
  const porChave = Object.fromEntries(resultados.map((r) => [r.chave, r]));
  assert.equal(porChave.porta.ok, true);
  assert.equal(porChave.porta.detalhe, 'sem porta configurada');
  assert.equal(porChave.processo.ok, true);
  assert.equal(porChave.bootstrap.ok, true);
  assert.equal(porChave.bootstrap.detalhe, 'servidor não está rodando');
});

test('doctor detecta outra instalação em execução pelo lock', async () => {
  const root = await mkdtemp(join(tmpdir(), 'geronticare-doctor-lock-'));
  await writeFile(join(root, 'install.lock'), `${process.pid}\n`);
  const resultados = await base({ root, config: { porta: 3000 }, segredos: {} });
  const lock = resultados.find((r) => r.chave === 'lock');
  assert.equal(lock.ok, false);
  assert.match(lock.detalhe, /outra instalação em execução/);
});

test('doctor sanitiza erro de conexão com o banco', async () => {
  const root = await mkdtemp(join(tmpdir(), 'geronticare-doctor-banco-'));
  const url = 'postgresql://usuario:senhasecreta@localhost:5432/geronticare';
  const resultados = await executarDoctor({
    root,
    config: { porta: 3000 },
    segredos: { DATABASE_URL: url },
    criarCliente: () => {
      throw new Error(`conexão recusada em ${url}`);
    },
    fetchFn: async () => ({ ok: false, status: 500 }),
    conectarPorta: async () => false,
    log: () => {},
  });
  const banco = resultados.find((r) => r.chave === 'banco');
  assert.equal(banco.ok, false);
  assert.ok(!banco.detalhe.includes('senhasecreta'));
  assert.ok(banco.detalhe.includes('***'));
});

test('doctor reporta migrations ausentes quando a consulta falha', async () => {
  const root = await mkdtemp(join(tmpdir(), 'geronticare-doctor-mig-'));
  const resultados = await executarDoctor({
    root,
    config: { porta: 3000 },
    segredos: { DATABASE_URL: 'postgresql://u:p@localhost:5432/geronticare' },
    criarCliente: () => clienteSimulado({ falharEm: ['__drizzle_migrations'] }),
    fetchFn: async () => ({ ok: false, status: 500 }),
    conectarPorta: async () => false,
    log: () => {},
  });
  const migracoes = resultados.find((r) => r.chave === 'migrations');
  assert.equal(migracoes.ok, false);
  assert.match(migracoes.detalhe, /migrations ausentes/);
});

test('doctor rejeita PostgreSQL fora de 16-18', async () => {
  const root = await mkdtemp(join(tmpdir(), 'geronticare-doctor-versao-'));
  const resultados = await executarDoctor({
    root,
    config: { porta: 3000 },
    segredos: { DATABASE_URL: 'postgresql://u:p@localhost:5432/geronticare' },
    criarCliente: () => clienteSimulado({ versao: '15.6' }),
    fetchFn: async () => ({ ok: false, status: 500 }),
    conectarPorta: async () => false,
    log: () => {},
  });
  const versao = resultados.find((r) => r.chave === 'versao');
  assert.equal(versao.ok, false);
  assert.match(versao.detalhe, /não suportada/);
});

test('doctor detecta secrets.json permissivo', async () => {
  const root = await mkdtemp(join(tmpdir(), 'geronticare-doctor-perms-'));
  await writeFile(join(root, 'secrets.json'), '{"DATABASE_URL":"postgresql://u:p@h/db"}', { mode: 0o644 });
  await chmod(join(root, 'secrets.json'), 0o644);
  const resultados = await executarDoctor({
    root,
    config: {},
    segredos: {},
    fetchFn: async () => ({ ok: false, status: 500 }),
    log: () => {},
  });
  const permissoes = resultados.find((resultado) => resultado.chave === 'permissoes');
  assert.equal(permissoes.ok, false);
  assert.match(permissoes.detalhe, /ACL|secrets\.json/);
});

test('doctor trata config de porta e versão inválidas sem sair do root', async () => {
  const root = await mkdtemp(join(tmpdir(), 'geronticare-doctor-config-'));
  const resultados = await executarDoctor({
    root,
    config: { porta: 'not-a-port', versao: '../../fora' },
    segredos: {},
    fetchFn: async () => ({ ok: false, status: 500 }),
    log: () => {},
  });
  const porChave = Object.fromEntries(resultados.map((resultado) => [resultado.chave, resultado]));
  assert.equal(porChave.porta.ok, false);
  assert.equal(porChave.release.ok, false);
  assert.match(porChave.release.detalhe, /versão inválida/);
});

test('doctor sinaliza bootstrap inconsistente', async () => {
  const root = await mkdtemp(join(tmpdir(), 'geronticare-doctor-bootstrap-'));
  const resultados = await executarDoctor({
    root,
    config: { porta: 3000 },
    segredos: {},
    conectarPorta: async () => true,
    fetchFn: async (url) => (url.endsWith('/api/health')
      ? { ok: true, status: 200 }
      : { ok: true, status: 200, json: async () => ({ necessario: false, inconsistente: true }) }),
    log: () => {},
  });
  const bootstrap = resultados.find((resultado) => resultado.chave === 'bootstrap');
  assert.equal(bootstrap.ok, false);
  assert.match(bootstrap.detalhe, /inconsistente/);
});
