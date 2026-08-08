import assert from 'node:assert/strict';
import test from 'node:test';

import { configurarSupabase } from '../src/db/supabase.js';

const PAT = 'sbp_teste_0123456789abcdef';

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

function respostaJson(corpo, { ok = true, status = 200 } = {}) {
  return { ok, status, json: async () => corpo };
}

test('configurarSupabase usa o PAT no header e escolhe o Session pooler', async () => {
  const chamadas = [];
  const fetchFn = async (url, opcoes) => {
    chamadas.push({ url, opcoes });
    if (url.endsWith('/projects')) {
      return respostaJson([
        { id: 'ref1', name: 'Meu Projeto', region: 'us-east-1' },
        { id: 'ref2', name: 'Outro', region: 'sa-east-1' },
      ]);
    }
    return respostaJson({
      pooler: [
        { host: 'aws-0-1.pooler.supabase.com', port: 6543, mode: 'PRIMARY', connection_type: 'transaction' },
        { host: 'aws-0-1.pooler.supabase.com', port: 5432, mode: 'PRIMARY', connection_type: 'session' },
      ],
      default: { user: 'postgres', database: 'postgres' },
    });
  };
  const registros = [];
  const criarCliente = async (uri) => {
    registros.push(uri);
    return clienteFake(registros);
  };
  const senhasPedidas = [];

  const resultado = await configurarSupabase({
    pedirPat: async () => PAT,
    pedirSenha: async () => {
      const senha = 'senha-super-secreta';
      senhasPedidas.push(senha);
      return senha;
    },
    pedirUri: async () => { throw new Error('não deveria pedir URI'); },
    selecionar: async () => 'ref2',
    fetchFn,
    criarCliente,
    log: () => {},
  });

  assert.equal(chamadas[0].url, 'https://api.supabase.com/v1/projects');
  assert.equal(chamadas[0].opcoes.headers.Authorization, `Bearer ${PAT}`);
  assert.equal(chamadas[1].url, 'https://api.supabase.com/v1/projects/ref2/config/database/pooler');
  assert.equal(
    resultado.databaseUrl,
    'postgresql://postgres:senha-super-secreta@aws-0-1.pooler.supabase.com:5432/postgres?sslmode=require',
  );
  assert.ok(registros.includes('CREATE TEMPORARY TABLE geronticare_prova (id integer)'));
  assert.deepEqual(senhasPedidas, ['senha-super-secreta']);
});

test('configurarSupabase cai para URI colada quando o pooler não vem no payload', async () => {
  let chamadas = 0;
  const fetchFn = async (url) => {
    chamadas += 1;
    if (url.endsWith('/projects')) return respostaJson([{ id: 'ref1', name: 'P', region: 'x' }]);
    return respostaJson({});
  };
  const uriColada = 'postgresql://postgres:senha-do-painel@aws-0-2.pooler.supabase.com:5432/postgres?sslmode=require';
  const registros = [];

  const resultado = await configurarSupabase({
    pedirPat: async () => PAT,
    pedirSenha: async () => { throw new Error('não deveria pedir senha'); },
    pedirUri: async () => uriColada,
    selecionar: async () => 'ref1',
    fetchFn,
    criarCliente: async () => clienteFake(registros),
    log: () => {},
  });

  assert.equal(resultado.databaseUrl, uriColada);
  assert.equal(chamadas, 2);
});

test('configurarSupabase cai para URI colada quando só há pooler transacional', async () => {
  const fetchFn = async (url) => {
    if (url.endsWith('/projects')) return respostaJson([{ id: 'ref1', name: 'P' }]);
    return respostaJson({
      pooler: { host: 'aws-0-1.pooler.supabase.com', port: 6543, mode: 'PRIMARY', connection_type: 'transaction' },
      default: { user: 'postgres', database: 'postgres' },
    });
  };

  const resultado = await configurarSupabase({
    pedirPat: async () => PAT,
    pedirSenha: async () => { throw new Error('não deveria pedir senha'); },
    pedirUri: async () => 'postgresql://postgres:s@aws-0-1.pooler.supabase.com:5432/postgres?sslmode=require',
    selecionar: async () => 'ref1',
    fetchFn,
    criarCliente: async () => clienteFake([]),
    log: () => {},
  });

  assert.match(resultado.databaseUrl, /pooler\.supabase\.com/);
});

test('configurarSupabase rejeita conexão direta sem IPv6 validável', async () => {
  const fetchFn = async (url) => {
    if (url.endsWith('/projects')) return respostaJson([{ id: 'ref1', name: 'P' }]);
    return respostaJson({});
  };

  await assert.rejects(
    configurarSupabase({
      pedirPat: async () => PAT,
      pedirSenha: async () => { throw new Error('não deveria pedir senha'); },
      pedirUri: async () => 'postgresql://postgres:senha-direta@db.ref1.supabase.co:5432/postgres',
      selecionar: async () => 'ref1',
      fetchFn,
      criarCliente: async () => {},
      lookupFn: async () => [],
      log: () => {},
    }),
    /pooler\.supabase\.com/,
  );
});

test('configurarSupabase aceita conexão direta quando IPv6 é validável', async () => {
  const fetchFn = async (url) => {
    if (url.endsWith('/projects')) return respostaJson([{ id: 'ref1', name: 'P' }]);
    return respostaJson({});
  };
  const resultado = await configurarSupabase({
    pedirPat: async () => PAT,
    pedirSenha: async () => { throw new Error('não deveria pedir senha'); },
    pedirUri: async () => 'postgresql://postgres:senha-direta@db.ref1.supabase.co:5432/postgres',
    selecionar: async () => 'ref1',
    fetchFn,
    lookupFn: async () => [{ address: '2001:db8::1', family: 6 }],
    criarCliente: async () => clienteFake([]),
    log: () => {},
  });
  assert.match(resultado.databaseUrl, /db\.ref1\.supabase\.co/);
});

test('configurarSupabase não vaza a senha em erros de conexão', async () => {
  const fetchFn = async (url) => {
    if (url.endsWith('/projects')) return respostaJson([{ id: 'ref1', name: 'P' }]);
    return respostaJson({
      pooler: { host: 'aws-0-1.pooler.supabase.com', port: 5432, mode: 'PRIMARY', connection_type: 'session' },
      default: { user: 'postgres', database: 'postgres' },
    });
  };

  await assert.rejects(
    configurarSupabase({
      pedirPat: async () => PAT,
      pedirSenha: async () => 'vaza-nao-esta-senha',
      pedirUri: async () => { throw new Error('não deveria pedir URI'); },
      selecionar: async () => 'ref1',
      fetchFn,
      criarCliente: async (uri) => { throw new Error(`conexão falhou para ${uri}`); },
      log: () => {},
    }),
    (erro) => {
      assert.ok(!erro.message.includes('vaza-nao-esta-senha'));
      assert.match(erro.message, /Não foi possível conectar/);
      return true;
    },
  );
});

test('configurarSupabase rejeita PAT curto', async () => {
  await assert.rejects(
    configurarSupabase({
      pedirPat: async () => 'curto',
      pedirSenha: async () => '',
      pedirUri: async () => '',
      selecionar: async () => '',
      fetchFn: async () => {},
      log: () => {},
    }),
    /inválido/,
  );
});

test('configurarSupabase reporta token inválido em 401', async () => {
  await assert.rejects(
    configurarSupabase({
      pedirPat: async () => PAT,
      pedirSenha: async () => '',
      pedirUri: async () => '',
      selecionar: async () => '',
      fetchFn: async () => respostaJson({}, { ok: false, status: 401 }),
      log: () => {},
    }),
    /Token de acesso Supabase inválido/,
  );
});
