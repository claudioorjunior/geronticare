import assert from 'node:assert/strict';
import test from 'node:test';

import { configurarBanco } from '../src/db/index.js';
import { POSTGRESAPP } from '../src/db/local.js';

const ENOENT = () => Object.assign(new Error('ENOENT'), { code: 'ENOENT' });

function clienteFake(registros) {
  function cliente(strings) {
    if (strings[0].includes('server_version')) return [{ versao: '17.2' }];
    registros.push('SELECT 1');
    return [];
  }
  cliente.unsafe = async (sql) => { registros.push(sql); };
  cliente.end = async () => {};
  return cliente;
}

test('despacha provedor local com instância existente', async () => {
  const chamadas = [];
  const executar = async (args) => {
    chamadas.push(args);
    if (args.includes('--version')) return { exitCode: 0, stdout: 'postgres (PostgreSQL) 17.2', stderr: '' };
    return { exitCode: 0, stdout: '', stderr: '' };
  };
  const fs = {
    stat: async (caminho) => {
      if (String(caminho).includes('Postgres.app')) return {};
      throw ENOENT();
    },
  };
  const confirmacoes = [];

  const resultado = await configurarBanco({
    provedor: 'local',
    executar,
    fs,
    confirmar: async ({ mensagem }) => { confirmacoes.push(mensagem); return true; },
    plataforma: 'darwin',
    root: '/root-teste',
    porta: 3000,
  });

  assert.equal(resultado.provedor, 'local');
  assert.equal(resultado.providerInfo.binDir, '/Applications/Postgres.app/Contents/Versions/16/bin');
  assert.equal(resultado.providerInfo.versao, 17);
  assert.match(resultado.databaseUrl, /^postgresql:\/\/geronticare_app:/);
  assert.deepEqual(confirmacoes, [], 'instância existente não deveria pedir confirmação');
  const psql = chamadas.find((args) => args.some((arg) => String(arg).endsWith('/psql')) && args.includes('-d'));
  assert.equal(psql[psql.indexOf('-p') + 1], '5432');
});

test('despacha provedor local instalando do zero após confirmação', async () => {
  const executar = async (args) => {
    if (args.includes('--version')) {
      return String(args[0]).includes('/root-teste/')
        ? { exitCode: 0, stdout: 'postgres (PostgreSQL) 16.4', stderr: '' }
        : { exitCode: 1, stdout: '', stderr: '' };
    }
    return { exitCode: 0, stdout: '', stderr: '' };
  };
  const fs = {
    stat: async () => { throw ENOENT(); },
    cp: async () => {},
    mkdir: async () => {},
    readFile: async () => Buffer.from('download'),
    writeFile: async () => {},
    rm: async () => {},
  };
  const confirmacoes = [];

  const resultado = await configurarBanco({
    provedor: 'local',
    executar,
    fs,
    baixar: async () => {},
    confirmar: async ({ mensagem }) => { confirmacoes.push(mensagem); return true; },
    plataforma: 'darwin',
    arquitetura: 'arm64',
    root: '/root-teste',
    log: () => {},
    hashFn: async () => POSTGRESAPP.sha256,
  });

  assert.equal(resultado.provedor, 'local');
  assert.equal(resultado.providerInfo.binDir, '/root-teste/Postgres.app/Contents/Versions/16/bin');
  assert.equal(resultado.providerInfo.versao, 16);
  assert.ok(confirmacoes.length >= 5, 'cada passo da instalação deveria ser confirmado');
  assert.match(resultado.databaseUrl, /geronticare_app:/);
});

test('despacha PostgreSQL existente no Windows com senha do superusuário', async () => {
  const chamadas = [];
  const executar = async (args, opcoes) => {
    chamadas.push({ args, opcoes });
    if (args.includes('--version')) return { exitCode: 0, stdout: 'postgres (PostgreSQL) 16.4', stderr: '' };
    return { exitCode: 0, stdout: '', stderr: '' };
  };
  const resultado = await configurarBanco({
    provedor: 'local',
    executar,
    fs: { stat: async () => ({}) },
    confirmar: async () => true,
    pedirSenhaSuperuser: async () => 'senha-superuser',
    plataforma: 'win32',
    arquitetura: 'x64',
    root: 'C:\\GerontiCare',
  });

  assert.equal(resultado.providerInfo.versao, 16);
  const psql = chamadas.find((chamada) => chamada.opcoes?.input?.startsWith('CREATE ROLE'));
  assert.equal(psql.args[psql.args.indexOf('-U') + 1], 'postgres');
  assert.equal(psql.opcoes.env.PGPASSWORD, 'senha-superuser');
});

test('despacha provedor neon', async () => {
  const executar = async (args) => {
    if (args.includes('connection-string')) {
      return { exitCode: 0, stdout: 'postgresql://u:s@ep-teste.neon.tech/db', stderr: '' };
    }
    return { exitCode: 0, stdout: JSON.stringify([{ id: 'x', name: 'x' }]), stderr: '' };
  };
  const registros = [];

  const resultado = await configurarBanco({
    provedor: 'neon',
    executar,
    selecionar: async () => 'x',
    criarCliente: async () => clienteFake(registros),
    log: () => {},
  });

  assert.equal(resultado.provedor, 'neon');
  assert.match(resultado.databaseUrl, /neon\.tech/);
});

test('despacha provedor supabase', async () => {
  const fetchFn = async (url) => {
    if (url.endsWith('/projects')) {
      return { ok: true, status: 200, json: async () => [{ id: 'ref1', name: 'P' }] };
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({
        pooler: { host: 'aws-0-1.pooler.supabase.com', port: 5432, mode: 'PRIMARY', connection_type: 'session' },
        default: { user: 'postgres', database: 'postgres' },
      }),
    };
  };

  const resultado = await configurarBanco({
    provedor: 'supabase',
    pedirPat: async () => 'sbp_teste_0123456789abcdef',
    pedirSenha: async () => 'senha-teste',
    pedirUri: async () => { throw new Error('não deveria pedir URI'); },
    selecionar: async () => 'ref1',
    fetchFn,
    criarCliente: async () => clienteFake([]),
    log: () => {},
  });

  assert.equal(resultado.provedor, 'supabase');
  assert.match(resultado.databaseUrl, /pooler\.supabase\.com/);
});

test('rejeita provedor desconhecido', async () => {
  await assert.rejects(configurarBanco({ provedor: 'mysql' }), /desconhecido/);
});
