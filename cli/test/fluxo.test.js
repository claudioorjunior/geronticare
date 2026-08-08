import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { executarFluxo, validarMatrizLocal, verificarPreflight } from '../src/fluxo.js';
import { POSTGRESAPP } from '../src/db/local.js';
import { ErroCancelado } from '../src/ui.js';

const SHA_APP = createHash('sha256').update('conteudo-do-app').digest('hex');

async function raizTemporaria(t) {
  const root = await mkdtemp(join(tmpdir(), 'geronticare-fluxo-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}

function uiFake({ selecoes = [] } = {}) {
  const chamadas = { selecionar: [], confirmar: [], senha: [], texto: [] };
  const logs = [];
  return {
    log: (...linhas) => logs.push(linhas.join(' ')),
    conclusao: () => {},
    selecionar: async (opcoes) => {
      chamadas.selecionar.push(opcoes);
      const valor = selecoes.shift();
      if (valor === Symbol.for('cancelar')) throw new ErroCancelado();
      return valor;
    },
    confirmar: async (opcoes) => {
      chamadas.confirmar.push(opcoes);
      return true;
    },
    senha: async (opcoes) => {
      chamadas.senha.push(opcoes);
      return 'senha-teste';
    },
    texto: async (opcoes) => {
      chamadas.texto.push(opcoes);
      return 'postgresql://uri';
    },
    chamadas,
    logs,
  };
}

function fetchFake({ monitorEstado = { necessario: false } } = {}) {
  const urls = [];
  const fn = async (url, opcoes) => {
    urls.push({ url, opcoes });
    if (url === 'https://github.com/') return { ok: true, status: 200 };
    if (url.endsWith('/api/health')) return { ok: true, status: 200 };
    if (url.endsWith('/api/setup')) {
      const estado = opcoes?.headers?.Authorization ? monitorEstado : { necessario: true };
      return { ok: true, status: 200, json: async () => estado };
    }
    if (url.endsWith('.sha256')) {
      return { ok: true, status: 200, body: [Buffer.from(`${SHA_APP}  geronticare-app-v0.5.0.tar.gz`)] };
    }
    if (url.endsWith('.tar.gz')) {
      return { ok: true, status: 200, body: [Buffer.from('conteudo-do-app')] };
    }
    return { ok: false, status: 404 };
  };
  fn.urls = urls;
  return fn;
}

function executarFake(log) {
  return async (args) => {
    log.push(args);
    if (args.includes('--version')) {
      return { exitCode: 0, stdout: 'postgres (PostgreSQL) 16.4', stderr: '' };
    }
    if (args[0] === 'tar' && args[1] === '-tzf') {
      return { exitCode: 0, stdout: 'package.json\napp/page.tsx\n' };
    }
    if (args[0] === 'tar' && args[1] === '-tvf') {
      return { exitCode: 0, stdout: '-rw-r--r-- 0 0 100 2026-01-01 00:00 package.json\n' };
    }
    return { exitCode: 0, stdout: '', stderr: '' };
  };
}

function executarNeonFake(log) {
  const fallback = executarFake(log);
  return async (args, opcoes) => {
    log.push(args);
    const texto = args.join(' ');
    if (texto.includes('auth')) return { exitCode: 0, stdout: '', stderr: '' };
    if (texto.includes('projects list')) return { exitCode: 0, stdout: '[{"id":"projeto-1","name":"Projeto"}]', stderr: '' };
    if (texto.includes('branches list')) return { exitCode: 0, stdout: '[{"id":"branch-1","name":"main"}]', stderr: '' };
    if (texto.includes('databases list')) return { exitCode: 0, stdout: '[{"id":"db-1","name":"geronticare"}]', stderr: '' };
    if (texto.includes('roles list')) return { exitCode: 0, stdout: '[{"id":"role-1","name":"geronticare"}]', stderr: '' };
    if (texto.includes('connection-string')) {
      return {
        exitCode: 0,
        stdout: JSON.stringify('postgresql://geronticare:senha-real-7f3c9b@ep-test.neon.tech/geronticare'),
        stderr: '',
      };
    }
    return fallback(args, opcoes);
  };
}

function spawnFake(log, { autoExit = true } = {}) {
  let emitirExit = null;
  const filho = {
    stdout: { on: () => {} },
    stderr: { on: () => {} },
    kill: (sinal) => {
      log.push(['kill', sinal]);
      if (emitirExit) emitirExit(0);
      return true;
    },
    once: (evento, callback) => {
      if (evento === 'spawn') queueMicrotask(callback);
      else if (evento === 'exit') emitirExit = callback;
    },
  };
  return (comando, args, opcoes) => {
    log.push(['spawn', comando, args, opcoes]);
    if (autoExit) queueMicrotask(() => emitirExit?.(0));
    return filho;
  };
}

function criarClienteFake() {
  return async () => {
    const cliente = async (strings) => {
      if (strings[0].includes('__drizzle_migrations')) return [{ n: 5 }];
      if (strings[0].includes('server_version')) return [{ versao: '16.4' }];
      return [{ '?column?': 1 }];
    };
    cliente.end = async () => {};
    cliente.unsafe = async () => [{}];
    return cliente;
  };
}

function fsBancoFake() {
  return {
    stat: async () => { throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' }); },
    cp: async () => {},
    readFile: async () => Buffer.from('{}'),
    writeFile: async () => {},
    mkdir: async () => {},
    rm: async () => {},
  };
}

function handoffFake() {
  return () => ({
    once: () => {},
    listen: (_porta, _host, callback) => queueMicrotask(callback),
    address: () => ({ port: 45678 }),
    close: (callback) => queueMicrotask(callback),
  });
}

function baseDeps({ root, ui, fetchFn, spawnFn, executar, extra = {} }) {
  return {
    ui,
    env: { GERONTICARE_HOME: root },
    platform: 'darwin',
    arquitetura: 'arm64',
    home: '/tmp',
    fetchFn,
    executar,
    spawnFn,
    portaLivreFn: async () => true,
    registrarSinal: () => () => {},
    abrirNavegador: () => {},
    criarCliente: criarClienteFake(),
    criarServidorHttp: handoffFake(),
    baixar: async () => {},
    fsBanco: fsBancoFake(),
    hashFn: async () => POSTGRESAPP.sha256,
    versao: '0.5.0',
    nodeVersion: 'v22.20.0',
    isTTY: true,
    fs: { statfs: async () => ({ bavail: 1_000_000, bsize: 4096 }) },
    ...extra,
  };
}

test('instalação completa com banco local chega a READY e limpa o token', async (t) => {
  const root = await raizTemporaria(t);
  const ui = uiFake({ selecoes: ['local'] });
  const fetchFn = fetchFake();
  const executarLog = [];
  const spawnLog = [];

  await executarFluxo(baseDeps({
    root, ui, fetchFn,
    executar: executarFake(executarLog),
    spawnFn: spawnFake(spawnLog),
  }));

  const estado = JSON.parse(await readFile(join(root, 'install-state.json'), 'utf8'));
  assert.equal(estado.fase, 'READY');
  assert.equal(estado.provedor, 'local');
  assert.equal(estado.porta, 3000);

  const config = JSON.parse(await readFile(join(root, 'config.json'), 'utf8'));
  assert.equal(config.host, '127.0.0.1');
  assert.equal(config.porta, 3000);

  const segredos = JSON.parse(await readFile(join(root, 'secrets.json'), 'utf8'));
  assert.ok(segredos.DATABASE_URL.startsWith('postgresql://geronticare_app:'));
  assert.ok(segredos.AUTH_SECRET.length >= 32);
  assert.equal(segredos.SETUP_TOKEN, undefined);

  assert.ok(executarLog.some((args) => args.some((parte) => String(parte).endsWith('migrate.mjs'))));
  assert.ok(executarLog.some((args) => args.includes('--webpack')));
  assert.ok(spawnLog.some((registro) => registro[0] === 'spawn'
    && registro[2]?.includes('start') && registro[2]?.includes('127.0.0.1')));
  const baixouRelease = fetchFn.urls.some(({ url }) => url.includes('releases/download/v0.5.0'));
  assert.ok(baixouRelease);
  const monitor = fetchFn.urls.find(({ url, opcoes }) => url.endsWith('/api/setup')
    && opcoes?.headers?.Authorization?.startsWith('Bearer '));
  assert.ok(monitor);
  assert.ok(monitor.opcoes.headers.Authorization.length > 'Bearer '.length + 32);
});

test('provedor cloud continua disponível fora da matriz Local', async (t) => {
  const root = await raizTemporaria(t);
  const ui = uiFake({ selecoes: ['nuvem', 'neon'] });
  const executarLog = [];

  await executarFluxo(baseDeps({
    root, ui, fetchFn: fetchFake(),
    executar: executarNeonFake(executarLog),
    spawnFn: spawnFake([]),
    extra: { platform: 'linux', arquitetura: 'arm64' },
  }));

  const estado = JSON.parse(await readFile(join(root, 'install-state.json'), 'utf8'));
  assert.equal(estado.fase, 'READY');
  assert.equal(estado.provedor, 'neon');
  assert.ok(executarLog.some((args) => args.includes('connection-string')));
  assert.equal(executarLog.some((args) => args.includes('sudo')), false);
});

test('Local rejeita distro Linux fora da matriz antes de persistir o provedor', async (t) => {
  const root = await raizTemporaria(t);
  await assert.rejects(
    executarFluxo(baseDeps({
      root,
      ui: uiFake({ selecoes: ['local'] }),
      fetchFn: fetchFake(),
      executar: executarFake([]),
      spawnFn: spawnFake([]),
      extra: { platform: 'linux', arquitetura: 'x64' },
    })),
    /banco de dados local não é suportado/,
  );
  const estado = JSON.parse(await readFile(join(root, 'install-state.json'), 'utf8'));
  assert.equal(estado.fase, 'PREFLIGHT');
  assert.equal(estado.provedor, undefined);
});

test('Local preserva a fase resumível quando a fonte Linux não oferece PostgreSQL 16', async (t) => {
  const root = await raizTemporaria(t);
  await assert.rejects(
    executarFluxo(baseDeps({
      root,
      ui: uiFake({ selecoes: ['local'] }),
      fetchFn: fetchFake(),
      executar: executarFake([]),
      spawnFn: spawnFake([]),
      extra: {
        platform: 'linux', arquitetura: 'x64', distroId: 'ubuntu', distroVersion: '22.04',
      },
    })),
    /PostgreSQL 16 não está disponível/,
  );
  const estado = JSON.parse(await readFile(join(root, 'install-state.json'), 'utf8'));
  assert.equal(estado.fase, 'DATABASE_SELECTED');
  assert.equal(estado.provedor, 'local');
});

test('falha ao validar banco preserva seleção e permite alterá-la na retomada', async (t) => {
  const root = await raizTemporaria(t);
  await writeFile(join(root, 'install-state.json'), JSON.stringify({
    fase: 'DATABASE_SELECTED', porta: 3000, provedor: 'local', versao: '0.5.0',
  }));
  await writeFile(join(root, 'secrets.json'), JSON.stringify({
    DATABASE_URL: 'postgresql://geronticare_app:senha-real@127.0.0.1:5432/geronticare',
  }));

  await assert.rejects(
    executarFluxo(baseDeps({
      root, ui: uiFake(), fetchFn: fetchFake(), executar: executarFake([]), spawnFn: spawnFake([]),
      extra: { criarCliente: async () => { throw new Error('banco indisponível'); } },
    })),
    /Não foi possível conectar ao banco de dados/,
  );
  const estado = JSON.parse(await readFile(join(root, 'install-state.json'), 'utf8'));
  assert.equal(estado.fase, 'DATABASE_SELECTED');
  assert.equal(estado.provedor, 'local');
  const segredos = JSON.parse(await readFile(join(root, 'secrets.json'), 'utf8'));
  assert.equal(segredos.DATABASE_URL, undefined);

  await executarFluxo(baseDeps({
    root,
    ui: uiFake({ selecoes: ['alterar', 'nuvem', 'neon'] }),
    fetchFn: fetchFake(),
    executar: executarNeonFake([]),
    spawnFn: spawnFake([]),
  }));
  const estadoFinal = JSON.parse(await readFile(join(root, 'install-state.json'), 'utf8'));
  assert.equal(estadoFinal.fase, 'READY');
  assert.equal(estadoFinal.provedor, 'neon');
});

test('resume da fase DATABASE_READY sem repetir prompts nem provedor', async (t) => {
  const root = await raizTemporaria(t);
  await writeFile(join(root, 'install-state.json'), JSON.stringify({
    fase: 'DATABASE_READY', porta: 3000, provedor: 'neon', versao: '0.5.0',
  }));
  await writeFile(join(root, 'secrets.json'), JSON.stringify({
    DATABASE_URL: 'postgresql://user:senha@ep-x.neon.tech/geronticare',
  }), { mode: 0o600 });

  const ui = uiFake();
  const fetchFn = fetchFake();
  const executarLog = [];
  const spawnLog = [];

  await executarFluxo(baseDeps({
    root, ui, fetchFn,
    executar: executarFake(executarLog),
    spawnFn: spawnFake(spawnLog),
  }));

  assert.equal(ui.chamadas.selecionar.length, 0);
  assert.equal(ui.chamadas.senha.length, 0);
  const estado = JSON.parse(await readFile(join(root, 'install-state.json'), 'utf8'));
  assert.equal(estado.fase, 'READY');
  assert.equal(estado.provedor, 'neon');
});

test('instalação já READY mostra menu e Sair não inicia servidor', async (t) => {
  const root = await raizTemporaria(t);
  await writeFile(join(root, 'install-state.json'), JSON.stringify({
    fase: 'READY', porta: 3000, provedor: 'local', versao: '0.5.0',
  }));
  const ui = uiFake({ selecoes: ['sair'] });
  const spawnLog = [];

  await executarFluxo(baseDeps({
    root, ui, fetchFn: fetchFake(),
    executar: executarFake([]),
    spawnFn: spawnFake(spawnLog),
  }));

  assert.equal(ui.chamadas.selecionar[0].opcoes.map((opcao) => opcao.value).join(','), 'iniciar,diagnosticar,sair');
  assert.equal(spawnLog.length, 0);
});

test('start com instalação READY inicia o servidor sem menu', async (t) => {
  const root = await raizTemporaria(t);
  await writeFile(join(root, 'install-state.json'), JSON.stringify({
    fase: 'READY', porta: 3100, provedor: 'local', versao: '0.5.0',
  }));
  await writeFile(join(root, 'config.json'), JSON.stringify({
    host: '127.0.0.1', porta: 3100, versao: '0.5.0', schemaVersion: 1, ativo: true,
  }));
  await writeFile(join(root, 'secrets.json'), JSON.stringify({
    DATABASE_URL: 'postgresql://user:senha@127.0.0.1:5432/geronticare',
    AUTH_SECRET: 'a'.repeat(43),
  }), { mode: 0o600 });
  await mkdir(join(root, 'releases', '0.5.0'), { recursive: true });
  const asset = Buffer.from('release-test');
  await writeFile(join(root, 'releases', '0.5.0', 'geronticare-app-v0.5.0.tar.gz'), asset);
  await writeFile(join(root, 'releases', '0.5.0', 'verified.json'), JSON.stringify({
    versao: '0.5.0', arquivo: 'geronticare-app-v0.5.0.tar.gz',
    sha256: createHash('sha256').update(asset).digest('hex'),
    nextPublicAppUrl: 'http://127.0.0.1:3100',
  }));

  const ui = uiFake();
  const spawnLog = [];
  await executarFluxo(baseDeps({
    root, ui, fetchFn: fetchFake(),
    executar: executarFake([]),
    spawnFn: spawnFake(spawnLog),
    extra: { comando: 'start' },
  }));

  assert.equal(ui.chamadas.selecionar.length, 0);
  assert.ok(spawnLog.some((registro) => registro[0] === 'spawn'));
});

test('start recusa release ausente em instalação READY', async (t) => {
  const root = await raizTemporaria(t);
  await writeFile(join(root, 'install-state.json'), JSON.stringify({
    fase: 'READY', porta: 3100, provedor: 'local', versao: '0.5.0',
  }));
  await writeFile(join(root, 'config.json'), JSON.stringify({
    host: '127.0.0.1', porta: 3100, versao: '0.5.0', schemaVersion: 1, ativo: true,
  }));
  await writeFile(join(root, 'secrets.json'), JSON.stringify({
    DATABASE_URL: 'postgresql://user:senha@127.0.0.1:5432/geronticare',
    AUTH_SECRET: 'a'.repeat(43),
  }), { mode: 0o600 });

  await assert.rejects(
    executarFluxo(baseDeps({
      root,
      ui: uiFake(),
      fetchFn: fetchFake(),
      executar: executarFake([]),
      spawnFn: spawnFake([]),
      extra: { comando: 'start' },
    })),
    /Release v0\.5\.0 não está disponível/,
  );
});

test('start retomando BOOTSTRAP_PENDING regenera token expirado e conclui', async (t) => {
  const root = await raizTemporaria(t);
  await writeFile(join(root, 'install-state.json'), JSON.stringify({
    fase: 'BOOTSTRAP_PENDING', porta: 3100, provedor: 'local', versao: '0.5.0',
  }));
  await writeFile(join(root, 'config.json'), JSON.stringify({
    host: '127.0.0.1', porta: 3100, versao: '0.5.0', schemaVersion: 1, ativo: true,
  }));
  await writeFile(join(root, 'secrets.json'), JSON.stringify({
    DATABASE_URL: 'postgresql://user:senha@127.0.0.1:5432/geronticare',
    AUTH_SECRET: 'a'.repeat(43),
    SETUP_TOKEN: 'token-antigo',
    SETUP_TOKEN_EXPIRES_AT: '2020-01-01T00:00:00.000Z',
  }), { mode: 0o600 });
  await mkdir(join(root, 'releases', '0.5.0'), { recursive: true });
  const asset = Buffer.from('release-test');
  await writeFile(join(root, 'releases', '0.5.0', 'geronticare-app-v0.5.0.tar.gz'), asset);
  await writeFile(join(root, 'releases', '0.5.0', 'verified.json'), JSON.stringify({
    versao: '0.5.0', arquivo: 'geronticare-app-v0.5.0.tar.gz',
    sha256: createHash('sha256').update(asset).digest('hex'),
    nextPublicAppUrl: 'http://127.0.0.1:3100',
  }));

  const fetchFn = fetchFake();
  const ui = uiFake();
  const spawnLog = [];
  await executarFluxo(baseDeps({
    root, ui, fetchFn,
    executar: executarFake([]),
    spawnFn: spawnFake(spawnLog),
    extra: { comando: 'start' },
  }));

  const segredos = JSON.parse(await readFile(join(root, 'secrets.json'), 'utf8'));
  assert.notEqual(segredos.SETUP_TOKEN, 'token-antigo');
  assert.equal(segredos.SETUP_TOKEN, undefined);
  const estado = JSON.parse(await readFile(join(root, 'install-state.json'), 'utf8'));
  assert.equal(estado.fase, 'READY');
  const spawn = spawnLog.find((registro) => registro[0] === 'spawn');
  const monitor = fetchFn.urls.find(({ url, opcoes }) => url.endsWith('/api/setup')
    && opcoes?.headers?.Authorization?.startsWith('Bearer '));
  assert.equal(spawn[3].env.SETUP_TOKEN, monitor.opcoes.headers.Authorization.slice('Bearer '.length));
});

test('SIGINT durante o servidor encerra o filho com SIGTERM', async (t) => {
  const root = await raizTemporaria(t);
  const ui = uiFake({ selecoes: ['local'] });
  const fetchFn = fetchFake();
  const executarLog = [];
  const killLog = [];
  let manipuladorSinal = null;
  const registrarSinal = (handler) => {
    manipuladorSinal = handler;
    return () => {};
  };
  const spawnFn = spawnFake(killLog, { autoExit: false });

  const fluxo = executarFluxo(baseDeps({
    root, ui, fetchFn,
    executar: executarFake(executarLog),
    spawnFn,
    extra: { registrarSinal },
  }));

  // espera o fluxo chegar na espera foreground (servidor "rodando")
  const limite = Date.now() + 3_000;
  while (!ui.logs.some((linha) => linha.includes('GerontiCare rodando'))) {
    if (Date.now() > limite) throw new Error('fluxo não chegou na espera do servidor');
    await new Promise((resolver) => setTimeout(resolver, 10));
  }
  manipuladorSinal();
  await fluxo;

  assert.ok(killLog.some((registro) => registro[0] === 'kill' && registro[1] === 'SIGTERM'));
  const estado = JSON.parse(await readFile(join(root, 'install-state.json'), 'utf8'));
  assert.equal(estado.fase, 'READY');
});

test('SIGINT durante migrations aborta o processo filho', async (t) => {
  const root = await raizTemporaria(t);
  const ui = uiFake({ selecoes: ['local'] });
  let manipuladorSinal = null;
  let sinalMigration = null;
  const registrarSinal = (handler) => {
    manipuladorSinal = handler;
    return () => {};
  };
  const executarBase = executarFake([]);
  const executar = async (args, opcoes = {}) => {
    if (args.some((parte) => String(parte).endsWith('migrate.mjs'))) {
      sinalMigration = opcoes.signal;
      return new Promise((resolver) => {
        opcoes.signal.addEventListener('abort', () => {
          resolver({ exitCode: -1, stdout: '', stderr: 'aborted' });
        }, { once: true });
      });
    }
    return executarBase(args, opcoes);
  };

  const fluxo = executarFluxo(baseDeps({
    root, ui, fetchFn: fetchFake(), executar, spawnFn: spawnFake([]),
    extra: { registrarSinal },
  }));
  const limite = Date.now() + 3_000;
  while (!sinalMigration) {
    if (Date.now() > limite) throw new Error('fluxo não chegou às migrations');
    await new Promise((resolver) => setTimeout(resolver, 10));
  }
  manipuladorSinal();
  await assert.rejects(fluxo, ErroCancelado);
  assert.equal(sinalMigration.aborted, true);
});

test('cancelamento na escolha do banco não deixa estado parcial', async (t) => {
  const root = await raizTemporaria(t);
  const ui = uiFake({ selecoes: [Symbol.for('cancelar')] });

  await assert.rejects(
    executarFluxo(baseDeps({
      root, ui, fetchFn: fetchFake(),
      executar: executarFake([]),
      spawnFn: spawnFake([]),
    })),
    ErroCancelado,
  );

  const estado = JSON.parse(await readFile(join(root, 'install-state.json'), 'utf8'));
  assert.equal(estado.fase, 'PREFLIGHT');
});

test('cancelamento durante a configuração preserva DATABASE_SELECTED para retomada', async (t) => {
  const root = await raizTemporaria(t);
  const ui = uiFake({ selecoes: ['local'] });
  ui.confirmar = async () => { throw new ErroCancelado(); };

  await assert.rejects(
    executarFluxo(baseDeps({
      root, ui, fetchFn: fetchFake(), executar: executarFake([]), spawnFn: spawnFake([]),
    })),
    ErroCancelado,
  );

  const estado = JSON.parse(await readFile(join(root, 'install-state.json'), 'utf8'));
  assert.equal(estado.fase, 'DATABASE_SELECTED');
  assert.equal(estado.provedor, 'local');
});

test('upgrade recusa cutover quando o servidor não é gerenciado (sem server.pid)', async (t) => {
  const root = await raizTemporaria(t);
  await writeFile(join(root, 'install-state.json'), JSON.stringify({
    fase: 'READY', porta: 3100, provedor: 'local', versao: '0.5.0',
  }));
  await writeFile(join(root, 'config.json'), JSON.stringify({
    host: '127.0.0.1', porta: 3100, versao: '0.5.0', schemaVersion: 1, ativo: true,
  }));
  await writeFile(join(root, 'secrets.json'), JSON.stringify({
    DATABASE_URL: 'postgresql://user:senha@127.0.0.1:5432/geronticare',
    AUTH_SECRET: 'a'.repeat(43),
  }), { mode: 0o600 });
  // release do alvo já verificada; prepararRelease não precisa baixar/compilar
  await mkdir(join(root, 'releases', '0.5.1'), { recursive: true });
  const asset = Buffer.from('release-alvo');
  await writeFile(join(root, 'releases', '0.5.1', 'geronticare-app-v0.5.1.tar.gz'), asset);
  await writeFile(join(root, 'releases', '0.5.1', 'verified.json'), JSON.stringify({
    versao: '0.5.1', arquivo: 'geronticare-app-v0.5.1.tar.gz',
    sha256: createHash('sha256').update(asset).digest('hex'),
    nextPublicAppUrl: 'http://127.0.0.1:3100',
  }));

  const ui = uiFake();
  const spawnLog = [];
  const executarLog = [];
  await assert.rejects(
    executarFluxo(baseDeps({
      root,
      ui,
      fetchFn: fetchFake(),
      executar: executarFake(executarLog),
      spawnFn: spawnFake(spawnLog),
      extra: { comando: 'upgrade', versaoAlvo: '0.5.1', conectarPortaFn: async () => true },
    })),
    /servidor não é gerenciado|server\.pid/,
  );

  // nenhum servidor deve ser iniciado; guarda antes de migrate mas backup/preparo (sem downtime) podem ocorrer
  assert.equal(spawnLog.some((registro) => registro[0] === 'spawn'), false);
  assert.equal(
    executarLog.some((args) => args.some((parte) => String(parte).endsWith('migrate.mjs'))),
    false,
  );
  // config continua na versão antiga
  const config = JSON.parse(await readFile(join(root, 'config.json'), 'utf8'));
  assert.equal(config.versao, '0.5.0');
});

test('doctor aponta problemas e falha com resumo', async (t) => {
  const root = await raizTemporaria(t);

  await assert.rejects(
    executarFluxo(baseDeps({
      root, ui: uiFake(), fetchFn: fetchFake(),
      executar: executarFake([]),
      spawnFn: spawnFake([]),
      extra: { comando: 'doctor' },
    })),
    /Doctor encontrou/,
  );
});

test('verificarPreflight valida plataforma, arquitetura e espaço', async () => {
  await assert.rejects(
    verificarPreflight({ platform: 'freebsd', arquitetura: 'x64', root: '/tmp' }),
    /Sistema operacional não suportado/,
  );
  await assert.rejects(
    verificarPreflight({ platform: 'win32', arquitetura: 'ia32', root: '/tmp' }),
    /Arquitetura ia32 não suportada/,
  );
  await assert.rejects(
    verificarPreflight({ platform: 'linux', arquitetura: 'arm64', root: '/tmp' }),
    /Arquitetura arm64 não suportada/,
  );
  await assert.rejects(
    verificarPreflight({ platform: 'darwin', arquitetura: 'arm64', versaoSistema: '21.6.0', root: '/tmp' }),
    /macOS 13/,
  );
  await assert.rejects(
    verificarPreflight({ platform: 'win32', arquitetura: 'x64', versaoSistema: '10.0.19044', root: '/tmp' }),
    /Windows 10 22H2/,
  );
  await assert.rejects(
    verificarPreflight({
      platform: 'darwin',
      arquitetura: 'arm64',
      root: '/tmp',
      fs: { statfs: async () => ({ bavail: 10, bsize: 4096 }) },
    }),
    /Espaço em disco insuficiente/,
  );
  await assert.doesNotReject(verificarPreflight({
    platform: 'darwin',
    arquitetura: 'arm64',
    root: '/tmp',
    fs: { statfs: async () => ({ bavail: 1_000_000, bsize: 4096 }) },
  }));
});

test('verificarPreflight usa o diretório pai quando o root ainda não existe', async () => {
  const chamadas = [];
  const root = '/tmp/geronticare-novo/root';
  await assert.doesNotReject(verificarPreflight({
    platform: 'darwin',
    arquitetura: 'arm64',
    root,
    fs: {
      statfs: async (caminho) => {
        chamadas.push(caminho);
        if (caminho === root) throw Object.assign(new Error('ausente'), { code: 'ENOENT' });
        return { bavail: 1_000_000, bsize: 4096 };
      },
    },
  }));
  assert.deepEqual(chamadas, [root, '/tmp/geronticare-novo']);
});

test('verificarPreflight falha quando a rede não está disponível', async () => {
  await assert.rejects(
    verificarPreflight({
      platform: 'darwin',
      arquitetura: 'arm64',
      root: '/tmp',
      verificarRede: true,
      fetchFn: async () => { throw new Error('offline'); },
      fs: { statfs: async () => ({ bavail: 1_000_000, bsize: 4096 }) },
    }),
    /rede para obter a release/,
  );
});

test('a matriz Local aceita versões reais do Windows e não bloqueia a nuvem fora da matriz', async () => {
  assert.doesNotThrow(() => validarMatrizLocal({
    platform: 'win32', arquitetura: 'x64', versaoSistema: 'Windows 10 Pro',
  }));
  assert.doesNotThrow(() => validarMatrizLocal({
    platform: 'win32', arquitetura: 'x64', versaoSistema: '10.0.22631',
  }));
  await assert.doesNotReject(verificarPreflight({
    platform: 'linux', arquitetura: 'arm64', root: '/tmp', validarMatriz: false,
    fs: { statfs: async () => ({ bavail: 1_000_000, bsize: 4096 }) },
  }));
  await assert.rejects(
    verificarPreflight({
      platform: 'linux', arquitetura: 'arm64', root: '/tmp',
      fs: { statfs: async () => ({ bavail: 1_000_000, bsize: 4096 }) },
    }),
    /Arquitetura arm64 não suportada/,
  );
});
