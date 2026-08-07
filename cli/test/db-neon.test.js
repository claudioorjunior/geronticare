import assert from 'node:assert/strict';
import test from 'node:test';

import { configurarNeon } from '../src/db/neon.js';

function clienteFake(registros) {
  function cliente(strings) {
    if (strings[0].includes('server_version')) return [{ versao: '16.4' }];
    registros.push('SELECT 1');
    return [];
  }
  cliente.unsafe = async (sql) => { registros.push(sql); };
  cliente.end = async () => {};
  return cliente;
}

const LISTA_UNICA = JSON.stringify([{ id: 'x', name: 'x' }]);

test('configurarNeon segue a sequência oficial da CLI e valida a conexão', async () => {
  const chamadas = [];
  const respostas = new Map([
    ['auth', { exitCode: 0, stdout: '', stderr: '' }],
    ['projects', { exitCode: 0, stdout: JSON.stringify([{ id: 'p1', name: 'Projeto A' }, { id: 'p2', name: 'Projeto B' }]), stderr: '' }],
    ['branches', { exitCode: 0, stdout: JSON.stringify([{ id: 'b1', name: 'main' }, { id: 'b2', name: 'dev' }]), stderr: '' }],
    ['databases', { exitCode: 0, stdout: JSON.stringify([{ name: 'db1' }, { name: 'db2' }]), stderr: '' }],
    ['roles', { exitCode: 0, stdout: JSON.stringify([{ name: 'role1' }, { name: 'role2' }]), stderr: '' }],
    ['connection-string', { exitCode: 0, stdout: JSON.stringify({ connection_string: 'postgresql://usuario:segredo@ep-teste.us-east-2.aws.neon.tech/db1' }), stderr: '' }],
  ]);
  const executar = async (args, opcoes) => {
    chamadas.push({ args, opcoes });
    const marcador = args.find((a) => ['auth', 'projects', 'branches', 'databases', 'roles', 'connection-string'].includes(a));
    return respostas.get(marcador) ?? { exitCode: 0, stdout: '', stderr: '' };
  };
  const escolhas = ['p2', 'b1', 'db2', 'role1'];
  const selecionar = async () => escolhas.shift();
  const registros = [];
  const criarCliente = async (uri) => {
    registros.push(['cliente', uri]);
    return clienteFake(registros);
  };

  const resultado = await configurarNeon({ executar, selecionar, criarCliente, log: () => {} });

  assert.equal(
    resultado.databaseUrl,
    'postgresql://usuario:segredo@ep-teste.us-east-2.aws.neon.tech/db1?sslmode=require',
  );
  assert.deepEqual(chamadas[0].args, ['npx', '--yes', 'neon@^2.45.0', 'auth']);
  assert.deepEqual(chamadas[0].opcoes, { tty: true });
  const conexao = chamadas.find((c) => c.args.includes('connection-string'));
  assert.deepEqual(conexao.args, [
    'npx', '--yes', 'neon@^2.45.0', 'connection-string',
    'b1', '--project-id', 'p2', '--database-name', 'db2', '--role-name', 'role1', '--ssl', 'require', '--output', 'json',
  ]);
  assert.ok(registros.includes('CREATE TEMPORARY TABLE geronticare_prova (id integer)'));
  assert.ok(registros.includes('DROP TABLE geronticare_prova'));
});

test('configurarNeon preserva sslmode já presente', async () => {
  const executar = async (args) => {
    if (args.includes('connection-string')) {
      return { exitCode: 0, stdout: 'postgresql://u:s@ep-teste.neon.tech/db?sslmode=require', stderr: '' };
    }
    return { exitCode: 0, stdout: LISTA_UNICA, stderr: '' };
  };

  const resultado = await configurarNeon({
    executar,
    selecionar: async () => 'x',
    criarCliente: async () => clienteFake([]),
    log: () => {},
  });

  assert.equal(resultado.databaseUrl, 'postgresql://u:s@ep-teste.neon.tech/db?sslmode=require');
});

test('configurarNeon rejeita conexão pooled', async () => {
  const executar = async (args) => {
    if (args.includes('connection-string')) {
      return { exitCode: 0, stdout: 'postgresql://u:s@ep-teste.neon.tech/db?pooled=true', stderr: '' };
    }
    return { exitCode: 0, stdout: LISTA_UNICA, stderr: '' };
  };

  await assert.rejects(
    configurarNeon({ executar, selecionar: async () => 'x', criarCliente: async () => {}, log: () => {} }),
    /pooled/,
  );
});

test('configurarNeon rejeita host fora de *.neon.tech', async () => {
  const executar = async (args) => {
    if (args.includes('connection-string')) {
      return { exitCode: 0, stdout: 'postgresql://u:s@evil.example/db', stderr: '' };
    }
    return { exitCode: 0, stdout: LISTA_UNICA, stderr: '' };
  };

  await assert.rejects(
    configurarNeon({ executar, selecionar: async () => 'x', criarCliente: async () => {}, log: () => {} }),
    /neon\.tech/,
  );
});

test('configurarNeon sanitiza erros da CLI', async () => {
  const executar = async () => ({
    exitCode: 1,
    stdout: '',
    stderr: 'token=segredo-pat-xyz postgresql://u:senha@host/db',
  });

  await assert.rejects(
    configurarNeon({ executar, selecionar: async () => 'x', log: () => {} }),
    (erro) => {
      assert.ok(!erro.message.includes('segredo-pat-xyz'));
      assert.ok(!erro.message.includes('senha@'));
      assert.match(erro.message, /Falha ao executar a CLI Neon/);
      return true;
    },
  );
});
