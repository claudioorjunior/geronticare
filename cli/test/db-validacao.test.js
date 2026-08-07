import assert from 'node:assert/strict';
import test from 'node:test';

import {
  gerarSenhaBanco,
  provarBanco,
  validarHostSufixo,
  validarUriPostgres,
  versaoPostgres,
} from '../src/db/validacao.js';

test('validarUriPostgres aceita URI postgresql completa e retorna sem espaços', () => {
  assert.equal(
    validarUriPostgres(' postgresql://usuario:segredo@host:5432/geronticare?sslmode=require '),
    'postgresql://usuario:segredo@host:5432/geronticare?sslmode=require',
  );
});

test('validarUriPostgres rejeita senhas placeholder', () => {
  for (const senha of ['***', 'senha', 'password', 'your_password', 'PASSWORD']) {
    assert.throws(
      () => validarUriPostgres(`postgresql://usuario:${senha}@host/geronticare`),
      /senha/,
      `deveria rejeitar a senha placeholder "${senha}"`,
    );
  }
});

test('validarUriPostgres rejeita URI sem senha quando exigida', () => {
  assert.throws(() => validarUriPostgres('postgresql://usuario@host/geronticare'), /senha/);
  assert.doesNotThrow(() => validarUriPostgres('postgresql://usuario@host/geronticare', { exigirSenha: false }));
});

test('validarUriPostgres rejeita protocolo não PostgreSQL', () => {
  assert.throws(() => validarUriPostgres('http://usuario:segredo@host/db'), /protocolo/);
  assert.throws(() => validarUriPostgres('isto não é uma uri'), /URI PostgreSQL/);
});

test('validarHostSufixo aceita somente o sufixo exato', () => {
  assert.equal(validarHostSufixo('ep-teste.neon.tech', ['.neon.tech']), true);
  assert.equal(validarHostSufixo('neon.tech', ['.neon.tech']), false);
  assert.equal(validarHostSufixo('falso-neon.tech', ['.neon.tech']), false);
  assert.equal(validarHostSufixo('aws-0-1.pooler.supabase.com', ['.pooler.supabase.com']), true);
});

test('gerarSenhaBanco gera base64url do tamanho pedido', () => {
  const senha = gerarSenhaBanco(24);
  assert.equal(senha.length, 32);
  assert.match(senha, /^[A-Za-z0-9_-]+$/);
  assert.notEqual(senha, gerarSenhaBanco(24));
});

test('provarBanco executa SELECT 1 e objeto temporário', async () => {
  const consultas = [];
  function cliente() {
    consultas.push('SELECT 1');
  }
  cliente.unsafe = async (sql) => { consultas.push(sql); };
  cliente.end = async () => {};

  await provarBanco(cliente);

  assert.deepEqual(consultas, [
    'SELECT 1',
    'CREATE TEMPORARY TABLE geronticare_prova (id integer)',
    'DROP TABLE geronticare_prova',
  ]);
});

test('provarBanco fecha o cliente e redige a falha', async () => {
  let encerrado = false;
  const cliente = {
    unsafe: async () => { throw new Error('postgresql://u:segredo@host/db'); },
    end: async () => { encerrado = true; },
  };

  await assert.rejects(provarBanco(cliente), /Não foi possível conectar ao banco de dados/);
  assert.equal(encerrado, true);
});

test('versaoPostgres retorna o major suportado', async () => {
  const cliente = () => [{ versao: '16.4' }];
  assert.equal(await versaoPostgres(cliente), 16);
});

test('versaoPostgres rejeita versão fora de 16-18', async () => {
  const cliente15 = () => [{ versao: '15.3' }];
  await assert.rejects(versaoPostgres(cliente15), /15/);
});
