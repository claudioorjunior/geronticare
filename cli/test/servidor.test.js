import assert from 'node:assert/strict';
import test from 'node:test';
import { join } from 'node:path';

import {
  aguardarProntidao,
  encerrarFilho,
  iniciarHandoff,
  iniciarServidor,
  monitorarBootstrap,
  montarAmbiente,
} from '../src/servidor.js';

function filhoFake() {
  const registros = { stdout: [], stderr: [], mortes: [] };
  const ouvintes = new Map();
  const filho = {
    stdout: { on: (evento, cb) => { if (evento === 'data') registros.stdout.push(cb); } },
    stderr: { on: (evento, cb) => { if (evento === 'data') registros.stderr.push(cb); } },
    on: (evento, cb) => ouvintes.set(evento, cb),
    once: (evento, cb) => ouvintes.set(evento, cb),
    kill: (sinal) => registros.mortes.push(sinal),
    emitir: (evento, ...args) => ouvintes.get(evento)?.(...args),
  };
  return { filho, registros };
}

test('montarAmbiente expõe as variáveis esperadas', () => {
  const ambiente = montarAmbiente({
    segredos: {
      DATABASE_URL: 'postgresql://u:s@h/db',
      AUTH_SECRET: 'segredo',
      SETUP_TOKEN: 'tok',
      SETUP_TOKEN_EXPIRES_AT: '2026-08-07T12:00:00Z',
    },
    config: { porta: 3210 },
  });
  assert.equal(ambiente.AUTH_URL, 'http://127.0.0.1:3210');
  assert.equal(ambiente.NEXT_PUBLIC_APP_URL, 'http://127.0.0.1:3210');
  assert.equal(ambiente.PORT, '3210');
  assert.equal(ambiente.NODE_ENV, 'production');
  assert.equal(ambiente.DATABASE_URL, 'postgresql://u:s@h/db');
  assert.equal(ambiente.SETUP_TOKEN, 'tok');
  assert.equal(ambiente.SETUP_TOKEN_EXPIRES_AT, '2026-08-07T12:00:00Z');
  assert.equal(ambiente.PATH, process.env.PATH);
  assert.equal(ambiente.HOME, process.env.HOME);
});

test('montarAmbiente omite SETUP_TOKEN quando ausente', () => {
  const ambiente = montarAmbiente({
    segredos: { DATABASE_URL: 'postgresql://u:s@h/db', AUTH_SECRET: 'segredo' },
    config: { porta: 3000 },
  });
  assert.equal('SETUP_TOKEN' in ambiente, false);
  assert.equal('SETUP_TOKEN_EXPIRES_AT' in ambiente, false);
});

test('iniciarServidor sobe o Next com ambiente e logs redigidos', async () => {
  const { filho, registros } = filhoFake();
  let spawnArgs;
  const linhas = [];
  const releaseDir = '/tmp/release-v1';

  const promessa = iniciarServidor({
    releaseDir,
    config: { porta: 4321 },
    segredos: { DATABASE_URL: 'postgresql://user:secret@host/db', AUTH_SECRET: 'as', SETUP_TOKEN: 'tok' },
    spawnFn: (cmd, args, opcoes) => {
      spawnArgs = { cmd, args, opcoes };
      return filho;
    },
    log: (linha) => linhas.push(linha),
  });
  filho.emitir('spawn');
  await promessa;

  assert.equal(spawnArgs.cmd, process.execPath);
  assert.deepEqual(spawnArgs.args, [
    join(releaseDir, 'node_modules', 'next', 'dist', 'bin', 'next'),
    'start', '-H', '127.0.0.1', '-p', '4321',
  ]);
  assert.equal(spawnArgs.opcoes.cwd, releaseDir);
  assert.equal(spawnArgs.opcoes.env.AUTH_URL, 'http://127.0.0.1:4321');
  assert.equal(spawnArgs.opcoes.env.NEXT_PUBLIC_APP_URL, 'http://127.0.0.1:4321');
  assert.equal(spawnArgs.opcoes.env.PORT, '4321');
  assert.equal(spawnArgs.opcoes.env.SETUP_TOKEN, 'tok');
  assert.equal(spawnArgs.opcoes.env.NODE_ENV, 'production');

  for (const cb of registros.stdout) {
    cb(Buffer.from('conectado em postgresql://user:secret@host/db\n'));
  }
  assert.ok(!linhas.some((linha) => linha.includes('secret')));
  assert.ok(linhas.some((linha) => linha.includes('postgresql://***:***@host/db')));
});

test('iniciarServidor rejeita com erro sanitizado no evento error', async () => {
  const { filho } = filhoFake();
  const promessa = iniciarServidor({
    releaseDir: '/tmp/r',
    config: { porta: 1 },
    segredos: { DATABASE_URL: 'postgresql://u:s@h/db', AUTH_SECRET: 'y' },
    spawnFn: () => filho,
  });
  filho.emitir('error', new Error('ENOENT: binário do Next ausente'));
  await assert.rejects(promessa, /Falha ao iniciar o servidor/);
});

test('aguardarProntidao espera health e setup responderem', async () => {
  let chamadas = 0;
  const fetchFn = async () => {
    chamadas += 1;
    if (chamadas <= 2) throw new Error('conexão recusada');
    if (chamadas === 3) return { ok: true, json: async () => ({ fase: 'X' }) };
    return { ok: true, json: async () => ({ necessario: true }) };
  };
  const resultado = await aguardarProntidao({
    porta: 9999,
    fetchFn,
    limiteMs: 5_000,
    intervaloMs: 1,
    log: () => {},
  });
  assert.deepEqual(resultado, { health: true, setup: true, estado: { necessario: true } });
});

test('aguardarProntidao expira quando o servidor nunca responde', async () => {
  const fetchFn = async () => {
    throw new Error('conexão recusada');
  };
  await assert.rejects(
    aguardarProntidao({ porta: 9999, fetchFn, limiteMs: 50, intervaloMs: 5, log: () => {} }),
    /não ficou pronto/,
  );
});

test('aguardarProntidao propaga cancelamento ao fetch', async () => {
  const controlador = new AbortController();
  let sinalRecebido;
  await assert.rejects(
    aguardarProntidao({
      porta: 9999,
      sinal: controlador.signal,
      fetchFn: async (_url, opcoes) => {
        sinalRecebido = opcoes.signal;
        controlador.abort();
        throw new Error('aborted');
      },
      limiteMs: 5_000,
      intervaloMs: 1,
      log: () => {},
    }),
    /interrompido/,
  );
  assert.equal(sinalRecebido, controlador.signal);
});

test('iniciarHandoff redireciona para destino fixo com cookie host-only', async () => {
  let handler;
  const servidor = {
    listen(porta, host, cb) {
      this.porta = porta;
      this.host = host;
      cb();
    },
    address() {
      return { port: 45678 };
    },
    close(cb) {
      this.fechado = true;
      cb();
    },
  };
  const criarServidorHttp = (h) => {
    handler = h;
    return servidor;
  };
  const { url, fechar } = await iniciarHandoff({ porta: 3000, token: 'tok123', criarServidorHttp, log: () => {} });
  assert.equal(url, 'http://127.0.0.1:45678/');
  assert.equal(servidor.host, '127.0.0.1');

  const cabecalhos = {};
  const resposta = {
    setHeader(chave, valor) {
      cabecalhos[chave] = valor;
    },
    end() {
      this.terminada = true;
    },
  };
  handler({ url: '/', headers: { host: 'evil.example' } }, resposta);
  assert.equal(resposta.statusCode, 302);
  assert.equal(cabecalhos.Location, 'http://127.0.0.1:3000/setup');
  assert.ok(!cabecalhos.Location.includes('evil.example'));
  const cookie = cabecalhos['Set-Cookie'];
  assert.ok(cookie.includes('geronticare.setup_token=tok123'));
  assert.ok(cookie.includes('HttpOnly'));
  assert.ok(cookie.includes('SameSite=Strict'));
  assert.ok(cookie.includes('Path=/'));
  assert.ok(cookie.includes('Max-Age=300'));

  const resposta404 = {
    setHeader() {},
    end() {
      this.terminada = true;
    },
  };
  handler({ url: '/outra', headers: {} }, resposta404);
  assert.equal(resposta404.statusCode, 404);

  await fechar();
  assert.equal(servidor.fechado, true);
});

test('monitorarBootstrap aguarda necessario=false', async () => {
  const fila = [
    { ok: true, status: 200, json: async () => ({ necessario: true }) },
    { ok: true, status: 200, json: async () => ({ necessario: true }) },
    { ok: true, status: 200, json: async () => ({ necessario: false }) },
  ];
  const fetchFn = async (url, opcoes) => {
    assert.ok(url.endsWith('/api/setup'));
    assert.equal(opcoes.headers.Authorization, 'Bearer tok');
    return fila.shift();
  };
  const resultado = await monitorarBootstrap({
    porta: 3000, token: 'tok', fetchFn, limiteMs: 5_000, intervaloMs: 1, log: () => {},
  });
  assert.deepEqual(resultado, { necessario: false });
});

test('monitorarBootstrap falha em estado inconsistente', async () => {
  const fetchFn = async () => ({
    ok: true,
    status: 200,
    json: async () => ({ necessario: false, inconsistente: true }),
  });
  await assert.rejects(
    monitorarBootstrap({ porta: 3000, token: 'tok', fetchFn, limiteMs: 5_000, intervaloMs: 1, log: () => {} }),
    /inconsistente/,
  );
});

test('monitorarBootstrap falha com token inválido ou expirado', async () => {
  const fetchFn = async () => ({ ok: false, status: 401 });
  await assert.rejects(
    monitorarBootstrap({ porta: 3000, token: 'tok', fetchFn, limiteMs: 5_000, intervaloMs: 1, log: () => {} }),
    /Token de configuração/,
  );
});

test('monitorarBootstrap expira com instrução de reabrir o navegador', async () => {
  const fetchFn = async () => ({ ok: true, status: 200, json: async () => ({ necessario: true }) });
  await assert.rejects(
    monitorarBootstrap({ porta: 3000, token: 'tok', fetchFn, limiteMs: 60, intervaloMs: 5, log: () => {} }),
    /npx geronticare@latest start/,
  );
});

test('encerrarFilho envia SIGTERM e aguarda a saída', async () => {
  const mortes = [];
  const filho = { kill: (sinal) => mortes.push(sinal) };
  const saida = Promise.resolve(0);
  const codigo = await encerrarFilho({ filho, saida, esperarMs: 1_000 });
  assert.equal(codigo, 0);
  assert.deepEqual(mortes, ['SIGTERM']);
});

test('encerrarFilho escala para SIGKILL quando não sai a tempo', async () => {
  const mortes = [];
  let resolverSaida;
  const saida = new Promise((resolver) => {
    resolverSaida = resolver;
  });
  const filho = {
    kill: (sinal) => {
      mortes.push(sinal);
      if (sinal === 'SIGKILL') resolverSaida(137);
    },
  };
  const codigo = await encerrarFilho({ filho, saida, esperarMs: 30 });
  assert.equal(codigo, 137);
  assert.deepEqual(mortes, ['SIGTERM', 'SIGKILL']);
});
