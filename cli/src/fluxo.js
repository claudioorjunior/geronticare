import { spawn } from 'node:child_process';
import { open, readFile, statfs as statfsPromises } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { release as osRelease } from 'node:os';

import { resolverHome } from './cli.js';
import { configurarBanco } from './db/index.js';
import { PORTA_POSTGRES_PADRAO, validarDistroLinux } from './db/local.js';
import { criarClientePostgres, provarComCliente } from './db/validacao.js';
import { executarDoctor } from './doctor.js';
import { escolherPorta } from './porta.js';
import { prepararRelease, releaseInstaladaValida } from './release.js';
import {
  escreverSegredos,
  gerarSegredo,
  lerSegredos,
  removerSegredo,
  sanitizarErro,
} from './secrets.js';
import {
  aguardarProntidao,
  encerrarFilho,
  iniciarHandoff,
  iniciarServidor,
  monitorarBootstrap,
} from './servidor.js';
import {
  comInstallLock,
  escreverArquivoAtomicamente,
  escreverEstado,
  lerArquivoJson,
  lerEstado,
} from './state.js';
import { criarUI, ErroCancelado } from './ui.js';
import { validarNode22, validarPreflight } from './preflight.js';

const ORDEM_FASES = new Map([
  ['PREFLIGHT', 1],
  ['DATABASE_SELECTED', 2],
  ['DATABASE_READY', 3],
  ['RELEASE_VERIFIED', 4],
  ['APP_BUILT', 5],
  ['CONFIGURED', 6],
  ['MIGRATED', 7],
  ['SERVER_READY', 8],
  ['BOOTSTRAP_PENDING', 9],
  ['READY', 10],
]);

const ESPACO_MINIMO = 300 * 1024 * 1024;

function executarPadrao(comando, opcoes = {}) {
  return new Promise((resolver, rejeitar) => {
    const { input, ...spawnOpcoes } = opcoes;
    const filho = spawn(comando[0], comando.slice(1), {
      ...spawnOpcoes,
      env: { ...process.env, ...(spawnOpcoes.env ?? {}), LC_ALL: 'C' },
      stdio: input === undefined ? ['inherit', 'pipe', 'pipe'] : ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    });
    let stdout = '';
    let stderr = '';
    filho.stdout?.on('data', (pedaco) => { stdout += pedaco; });
    filho.stderr?.on('data', (pedaco) => { stderr += pedaco; });
    filho.once('error', rejeitar);
    filho.once('spawn', () => {
      if (input !== undefined) filho.stdin.end(input);
    });
    filho.once('close', (codigo) => resolver({ exitCode: codigo ?? 1, stdout, stderr }));
  });
}

async function baixarPadrao(url, destino, { signal } = {}) {
  const resposta = await fetch(url, signal ? { signal } : undefined);
  if (!resposta.ok) {
    throw new Error(`Falha ao baixar ${url} (HTTP ${resposta.status}).`);
  }
  const arquivo = await open(destino, 'w', 0o600);
  try {
    for await (const pedaco of resposta.body) {
      await arquivo.write(pedaco);
    }
  } finally {
    await arquivo.close();
  }
}

function registrarSinalPadrao(handler) {
  const ouvinte = () => handler();
  process.once('SIGINT', ouvinte);
  return () => process.removeListener('SIGINT', ouvinte);
}

function abrirNavegadorPadrao(url, platform = process.platform) {
  try {
    if (platform === 'darwin') {
      spawn('open', [url], { detached: true, stdio: 'ignore' }).unref();
    } else if (platform === 'linux') {
      spawn('xdg-open', [url], { detached: true, stdio: 'ignore' }).unref();
    } else if (platform === 'win32') {
      spawn('cmd', ['/c', 'start', '', url], { detached: true, stdio: 'ignore', windowsHide: true }).unref();
    }
  } catch {
    // abrir o navegador é best-effort; o usuário pode abrir a URL manualmente.
  }
}

async function lerVersaoPackage() {
  const url = new URL('../package.json', import.meta.url);
  return JSON.parse(await readFile(url, 'utf8')).version;
}

export async function verificarPreflight({
  platform,
  arquitetura,
  root,
  fs = { statfs: statfsPromises },
  versaoSistema,
  fetchFn,
  verificarRede = false,
  validarMatriz = true,
} = {}) {
  if (validarMatriz) {
    validarMatrizLocal({ platform, arquitetura, versaoSistema });
  }
  try {
    let info;
    try {
      info = await fs.statfs(root);
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
      info = await fs.statfs(dirname(root));
    }
    const livre = Number(info.bavail) * Number(info.bsize);
    if (livre < ESPACO_MINIMO) {
      throw new Error('Espaço em disco insuficiente para instalar o GerontiCare (mínimo 300 MB).');
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('Espaço em disco')) throw error;
    // statfs indisponível (filesystem sem suporte): segue sem essa checagem.
  }
  if (verificarRede) {
    try {
      const resposta = await (fetchFn ?? fetch)('https://github.com/', { method: 'HEAD' });
      if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);
    } catch {
      throw new Error('Não foi possível acessar a rede para obter a release do GerontiCare.');
    }
  }
}

function buildWindows(versaoSistema) {
  const texto = String(versaoSistema ?? '');
  const build = texto.match(/(?:^|[^\d])(?:10\.0\.)?(\d{5,6})(?:$|[^\d])/i)?.[1];
  if (build) return Number.parseInt(build, 10);
  if (/Windows\s+11\b/i.test(texto)) return 22_000;
  if (/Windows\s+10\b/i.test(texto)) return 19_045;
  return Number.NaN;
}

export function validarMatrizLocal({ platform, arquitetura, versaoSistema } = {}) {
  const suportadas = new Set(['darwin', 'linux', 'win32']);
  if (!suportadas.has(platform)) {
    throw new Error('Sistema operacional não suportado pelo instalador local.');
  }
  const arquiteturas = { darwin: new Set(['x64', 'arm64']), linux: new Set(['x64']), win32: new Set(['x64']) };
  if (!arquiteturas[platform].has(arquitetura)) {
    throw new Error(`Arquitetura ${arquitetura} não suportada neste sistema.`);
  }
  const versaoOs = versaoSistema
    ?? (platform === process.platform ? osRelease() : null);
  if (platform === 'darwin' && versaoOs && Number.parseInt(String(versaoOs), 10) < 22) {
    throw new Error('macOS 13 ou superior é necessário para a instalação local.');
  }
  if (platform === 'win32' && versaoOs) {
    const build = buildWindows(versaoOs);
    if (!Number.isInteger(build) || build < 19_045) {
      throw new Error('Windows 10 22H2 ou Windows 11 é necessário para a instalação local.');
    }
  }
}

function portaDesejada(env) {
  const porta = Number.parseInt(env.GERONTICARE_PORT ?? '', 10);
  return Number.isInteger(porta) && porta > 0 && porta < 65_536 ? porta : 3000;
}

function portaValida(porta) {
  return Number.isInteger(porta) && porta >= 1 && porta <= 65_535 && porta !== PORTA_POSTGRES_PADRAO;
}

export async function executarFluxo({
  comando = 'install',
  ui = criarUI(),
  env = process.env,
  platform = process.platform,
  arquitetura = process.arch,
  home,
  fetchFn = fetch,
  executar = executarPadrao,
  spawnFn = spawn,
  fs = { statfs: statfsPromises },
  portaLivreFn,
  versaoSistema,
  registrarSinal = registrarSinalPadrao,
  abrirNavegador = abrirNavegadorPadrao,
  criarCliente = criarClientePostgres,
  criarServidorHttp,
  baixar = baixarPadrao,
  hashFn,
  fsBanco,
  distroId,
  distroVersion,
  versao = null,
  nodeVersion = process.version,
  isTTY = process.stdin.isTTY === true,
} = {}) {
  const root = resolverHome({ env, platform, home });
  const servicos = {
    ui, root, env, platform, arquitetura, fetchFn, executar, spawnFn,
    versaoSistema,
    registrarSinal, abrirNavegador, criarCliente, portaLivreFn,
    criarServidorHttp,
    baixar,
    hashFn,
    fsBanco,
    distroId,
    distroVersion,
    versao: versao ?? await lerVersaoPackage(),
  };

  if (comando === 'doctor') {
    return diagnosticar({ ...servicos, isTTY });
  }
  if (comando === 'start') {
    validarNode22(nodeVersion);
    const estadoExistente = await lerEstado(root);
    const versaoEfetiva = estadoExistente?.versao ?? servicos.versao;
    const servicosStart = versaoEfetiva === servicos.versao
      ? servicos
      : { ...servicos, versao: versaoEfetiva };
    let resultadoStart;
    await comInstallLock(root, async () => {
      resultadoStart = await instalarOuIniciar({ ...servicosStart, somenteIniciar: true });
    });
    return resultadoStart;
  }

  validarPreflight({ nodeVersion, isTTY });
  await verificarPreflight({
    platform,
    arquitetura,
    root,
    fs,
    fetchFn,
    versaoSistema,
    verificarRede: true,
    validarMatriz: false,
  });
  const estadoInicial = await lerEstado(root);
  const versaoInstalacao = estadoInicial?.versao ?? servicos.versao;
  const servicosInstalacao = versaoInstalacao === servicos.versao
    ? servicos
    : { ...servicos, versao: versaoInstalacao };
  const portaInicial = estadoInicial
    ? undefined
    : await escolherPorta({
      portaDesejada: portaDesejada(env),
      portaLivreFn,
      portasReservadas: new Set([PORTA_POSTGRES_PADRAO]),
    });
  await comInstallLock(root, () => instalarOuIniciar({ ...servicosInstalacao, portaInicial }));
}

async function diagnosticar({ ui, root, criarCliente, fetchFn }) {
  const config = await lerArquivoJson(root, 'config.json');
  const segredos = await lerSegredos(root);
  const resultados = await executarDoctor({
    root, config, segredos, criarCliente, fetchFn, log: ui.log,
  });
  const problemas = resultados.filter((resultado) => !resultado.ok);
  if (problemas.length > 0) {
    throw new Error(`Doctor encontrou ${problemas.length} problema(s). Corrija antes de iniciar.`);
  }
  ui.log('Doctor: nenhum problema encontrado.');
}

async function instalarOuIniciar({
  ui, root, env, platform, arquitetura, fetchFn, executar, spawnFn,
  registrarSinal, abrirNavegador, criarCliente, versao, somenteIniciar = false,
  criarServidorHttp, baixar, hashFn, fsBanco, portaLivreFn, portaInicial, versaoSistema,
  distroId, distroVersion,
}) {
  let estado = await lerEstado(root);
  let faseAtual = ORDEM_FASES.get(estado?.fase) ? estado.fase : 'PREFLIGHT';

  if (somenteIniciar) {
    if (faseAtual !== 'SERVER_READY' && faseAtual !== 'BOOTSTRAP_PENDING' && faseAtual !== 'READY') {
      throw new Error(
        'Instalação incompleta (fase ' + (estado?.fase ?? 'ausente') + '). '
        + 'Rode `npx geronticare@latest` para instalar ou retomar.',
      );
    }
  }

  if (faseAtual === 'DATABASE_SELECTED' && !somenteIniciar) {
    const segredosSelecionados = await lerSegredos(root);
    if (!segredosSelecionados?.DATABASE_URL) {
      const acao = await ui.selecionar({
        mensagem: 'A configuração do banco não foi concluída. O que você quer fazer?',
        opcoes: [
          { value: 'retomar', label: 'Tentar novamente', hint: `Continuar com ${estado.provedor}` },
          { value: 'alterar', label: 'Escolher outro provedor', hint: 'Voltar à seleção de banco' },
        ],
      });
      if (acao === 'alterar') {
        await escreverEstado(root, { fase: 'PREFLIGHT', porta: estado.porta, versao });
        estado = { fase: 'PREFLIGHT', porta: estado.porta };
        faseAtual = 'PREFLIGHT';
      }
    }
  }

  if (faseAtual === 'READY' && !somenteIniciar) {
    const escolha = await ui.selecionar({
      mensagem: 'A instalação já está concluída. O que você quer fazer?',
      opcoes: [
        { value: 'iniciar', label: 'Iniciar' },
        { value: 'diagnosticar', label: 'Diagnosticar' },
        { value: 'sair', label: 'Sair' },
      ],
    });
    if (escolha === 'diagnosticar') return diagnosticar({ ui, root, criarCliente, fetchFn });
    if (escolha === 'sair') {
      ui.log('Até logo.');
      return;
    }
  }

  let cancelado = false;
  const controlador = new AbortController();
  const limparCancelamento = registrarSinal(() => {
    cancelado = true;
    controlador.abort();
  });
  let filho = null;
  let saidaServidor = null;
  let handoff = null;
  let servidorEncerrado = false;

  const cancelarSe = () => {
    if (cancelado) throw new ErroCancelado();
  };

  try {
    let porta = portaValida(estado?.porta) ? estado.porta : portaInicial;
    if (!porta) {
      porta = await escolherPorta({
        portaDesejada: portaDesejada(env),
        portaLivreFn,
        portasReservadas: new Set([PORTA_POSTGRES_PADRAO]),
      });
    }
    cancelarSe();

    if (ORDEM_FASES.get(faseAtual) <= 1) {
      await escreverEstado(root, { fase: 'PREFLIGHT', porta, versao });
      estado = { fase: 'PREFLIGHT', porta };
    }
    cancelarSe();

    let provedor = estado?.provedor;
    if (ORDEM_FASES.get(faseAtual) <= 2 && !provedor) {
      const escolha = await ui.selecionar({
        mensagem: 'Onde você quer armazenar os dados do GerontiCare?',
        opcoes: [
          { value: 'local', label: 'Banco de dados local', hint: 'Instalado e executado neste computador' },
          { value: 'nuvem', label: 'Banco de dados na nuvem (gerenciado)', hint: 'Conecte Neon, Supabase ou outro serviço compatível' },
        ],
      });
      provedor = escolha === 'nuvem'
        ? await ui.selecionar({
          mensagem: 'Qual provedor gerenciado você quer usar?',
          opcoes: [
            { value: 'neon', label: 'Neon', hint: 'PostgreSQL gerenciado' },
            { value: 'supabase', label: 'Supabase', hint: 'PostgreSQL gerenciado' },
          ],
        })
        : 'local';
    }
    if (provedor === 'local') {
      validarMatrizLocal({ platform, arquitetura, versaoSistema });
      if (platform === 'linux') {
        await validarDistroLinux({ fs: fsBanco, distroId, distroVersion });
      }
    }
    if (ORDEM_FASES.get(faseAtual) <= 2 && !estado?.provedor) {
      await escreverEstado(root, { fase: 'DATABASE_SELECTED', porta, provedor, versao });
      estado = { fase: 'DATABASE_SELECTED', porta, provedor };
    }
    cancelarSe();

    let segredos = await lerSegredos(root);
    const ordemFase = ORDEM_FASES.get(faseAtual);
    if (ordemFase > 3) {
      if (!segredos?.DATABASE_URL) {
        throw new Error('DATABASE_URL ausente para retomar a instalação. Rode o instalador novamente.');
      }
      await provarComCliente(criarCliente, segredos.DATABASE_URL);
    }
    if (ordemFase > 4 && !(await releaseInstaladaValida({ root, versao, porta }))) {
      throw new Error(`Release v${versao} não está disponível ou íntegra. Rode o instalador novamente.`);
    }
    if (ordemFase >= 7) {
      const configPersistida = await lerArquivoJson(root, 'config.json');
      if (!configPersistida
        || configPersistida.host !== '127.0.0.1'
        || configPersistida.porta !== porta
        || configPersistida.versao !== versao
        || configPersistida.ativo !== true) {
        throw new Error('config.json ausente ou inconsistente para retomar a instalação. Rode o doctor.');
      }
    }
    if (ORDEM_FASES.get(faseAtual) <= 3) {
      let databaseUrl = segredos?.DATABASE_URL;
      if (!databaseUrl) {
        ui.log('Configurando o banco de dados...');
        const resultado = await configurarBanco({
          provedor,
          root,
          porta,
          portaPostgres: PORTA_POSTGRES_PADRAO,
          confirmar: ui.confirmar,
          selecionar: ui.selecionar,
          pedirPat: () => ui.senha({
            mensagem: 'Cole seu token de acesso pessoal (PAT) do Supabase:',
            placeholder: 'sbp_…',
          }),
          pedirSenha: () => ui.senha({
            mensagem: 'Senha do banco de dados:',
            placeholder: '••••••••',
          }),
          pedirSenhaSuperuser: () => ui.senha({
            mensagem: 'Senha da role postgres do PostgreSQL local:',
            placeholder: '••••••••',
          }),
          pedirUri: () => ui.texto({
            mensagem: 'Cole a Session pooler URI exibida no painel do Supabase:',
            placeholder: 'postgresql://…',
          }),
          criarCliente,
          fetchFn,
          executar,
          baixar,
          hashFn,
          sinal: controlador.signal,
          fs: fsBanco,
          distroId,
          distroVersion,
          log: ui.log,
          plataforma: platform,
          arquitetura,
        });
        databaseUrl = resultado.databaseUrl;
      }
      cancelarSe();
      await provarComCliente(criarCliente, databaseUrl);
      if (!segredos?.DATABASE_URL) {
        await escreverSegredos(root, { DATABASE_URL: databaseUrl });
        segredos = { DATABASE_URL: databaseUrl };
      }
      await escreverEstado(root, { fase: 'DATABASE_READY', porta, provedor, versao });
      estado = { fase: 'DATABASE_READY', porta, provedor };
    }
    cancelarSe();

    if (ORDEM_FASES.get(faseAtual) <= 4) {
      ui.log(`Baixando e compilando o GerontiCare v${versao}...`);
      await prepararRelease({
        root,
        versao,
        porta,
        fetchFn,
        spawnFn: executar,
        log: ui.log,
        sinal: controlador.signal,
      });
      await escreverEstado(root, { fase: 'RELEASE_VERIFIED', porta, provedor, versao });
      await escreverEstado(root, { fase: 'APP_BUILT', porta, provedor, versao });
      estado = { fase: 'APP_BUILT', porta, provedor };
    }
    cancelarSe();

    if (ORDEM_FASES.get(faseAtual) <= 6) {
      const config = {
        host: '127.0.0.1',
        porta,
        versao,
        schemaVersion: 1,
        ativo: false,
      };
      await escreverArquivoAtomicamente(root, 'config.json', config);
      segredos = {
        DATABASE_URL: segredos?.DATABASE_URL,
        AUTH_SECRET: gerarSegredo(),
        SETUP_TOKEN: gerarSegredo(),
        SETUP_TOKEN_EXPIRES_AT: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      };
      await escreverSegredos(root, segredos);
      await escreverEstado(root, { fase: 'CONFIGURED', porta, provedor, versao, erro: undefined });
      estado = { fase: 'CONFIGURED', porta, provedor };
    }
    cancelarSe();

    const releaseDir = join(root, 'releases', versao);
    if (ORDEM_FASES.get(faseAtual) <= 7) {
      ui.log('Aplicando migrations do banco de dados...');
      const resultado = await executar(
        [process.execPath, join(releaseDir, 'scripts', 'migrate.mjs')],
        {
          cwd: releaseDir,
          env: { ...process.env, DATABASE_URL: segredos.DATABASE_URL },
          signal: controlador.signal,
        },
      );
      if (resultado.exitCode !== 0) {
        throw new Error(
          'Falha ao aplicar as migrations do banco de dados. Nada foi desfeito; '
          + 'rode `npx geronticare@latest doctor` para diagnosticar.',
        );
      }
      await verificarMarcador({ databaseUrl: segredos.DATABASE_URL, criarCliente });
      await escreverArquivoAtomicamente(root, 'config.json', {
        host: '127.0.0.1',
        porta,
        versao,
        schemaVersion: 1,
        ativo: true,
      });
      await escreverEstado(root, { fase: 'MIGRATED', porta, provedor, versao });
      estado = { fase: 'MIGRATED', porta, provedor };
    }
    cancelarSe();

    const config = (await lerArquivoJson(root, 'config.json'))
      ?? { host: '127.0.0.1', porta, versao, schemaVersion: 1 };
    let segredosAtuais = (await lerSegredos(root)) ?? segredos;

    if (ORDEM_FASES.get(faseAtual) <= 9
      && (!segredosAtuais?.SETUP_TOKEN || expirado(segredosAtuais.SETUP_TOKEN_EXPIRES_AT))) {
      segredosAtuais = {
        ...segredosAtuais,
        SETUP_TOKEN: gerarSegredo(),
        SETUP_TOKEN_EXPIRES_AT: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      };
      await escreverSegredos(root, segredosAtuais);
    }

    if (!filho) {
      ui.log(`Iniciando o servidor em http://127.0.0.1:${porta}...`);
      const inicio = await iniciarServidor({
        releaseDir,
        config,
        segredos: segredosAtuais,
        spawnFn,
        log: ui.log,
      });
      filho = inicio.filho;
      saidaServidor = inicio.saida;
      try {
        await aguardarProntidao({ porta, fetchFn, log: ui.log, sinal: controlador.signal });
      } catch (error) {
        if (cancelado) throw new ErroCancelado();
        throw error;
      }
      await escreverEstado(root, { fase: 'SERVER_READY', porta, provedor, versao });
      estado = { fase: 'SERVER_READY', porta, provedor };
    }
    cancelarSe();

    if (ORDEM_FASES.get(faseAtual) <= 9) {
      handoff = await iniciarHandoff({
        porta,
        token: segredosAtuais.SETUP_TOKEN,
        log: ui.log,
        criarServidorHttp,
      });
      abrirNavegador(handoff.url, platform);
      ui.log(`Conclua a configuração inicial no navegador (${handoff.url}).`);
      await escreverEstado(root, { fase: 'BOOTSTRAP_PENDING', porta, provedor, versao });
      try {
        await monitorarBootstrap({
          porta,
          token: segredosAtuais.SETUP_TOKEN,
          fetchFn,
          log: ui.log,
          sinal: controlador.signal,
        });
      } catch (error) {
        if (cancelado) throw new ErroCancelado();
        throw error;
      }
      await removerSegredo(root, 'SETUP_TOKEN');
      await removerSegredo(root, 'SETUP_TOKEN_EXPIRES_AT');
      await escreverEstado(root, { fase: 'READY', porta, provedor, versao });
      await handoff.fechar();
      handoff = null;
      ui.conclusao('Instalação concluída. O servidor está rodando.');
    }

    ui.log(`GerontiCare rodando em http://127.0.0.1:${porta} (Ctrl+C para parar).`);
    await new Promise((resolver) => {
      saidaServidor.then((codigo) => {
        servidorEncerrado = true;
        if (codigo !== 0) {
          ui.log(`O servidor encerrou inesperadamente (código ${codigo}). Rode \`npx geronticare@latest doctor\`.`);
        }
        resolver();
      });
      registrarSinal(() => {
        servidorEncerrado = true;
        ui.log('Parando o servidor...');
        encerrarFilho({ filho, saida: saidaServidor }).then(() => resolver());
      });
    });
  } catch (error) {
    const ultimoEstado = await lerEstado(root).catch(() => null);
    const bancoAindaNaoValidado = ultimoEstado?.fase === 'DATABASE_SELECTED';
    if (bancoAindaNaoValidado) {
      await removerSegredo(root, 'DATABASE_URL').catch(() => {});
      await escreverEstado(root, {
        ...ultimoEstado,
        erro: cancelado ? 'Instalação cancelada; a fase DATABASE_SELECTED pode ser retomada ou alterada.' : sanitizarErro(error instanceof Error ? error.message : 'Falha inesperada.'),
      }).catch(() => {});
    } else if (!cancelado && ultimoEstado) {
      await escreverEstado(root, {
        ...ultimoEstado,
        erro: sanitizarErro(error instanceof Error ? error.message : 'Falha inesperada.'),
      }).catch(() => {});
    }
    if (cancelado) throw new ErroCancelado();
    throw error;
  } finally {
    limparCancelamento();
    if (handoff) await handoff.fechar().catch(() => {});
    if (filho && !servidorEncerrado) {
      await encerrarFilho({ filho, saida: saidaServidor }).catch(() => {});
    }
  }
}

function expirado(expiraEm) {
  const ms = Date.parse(expiraEm ?? '');
  return !Number.isFinite(ms) || ms <= Date.now();
}

async function verificarMarcador({ databaseUrl, criarCliente }) {
  const cliente = await criarCliente(databaseUrl);
  try {
    const [linha] = await cliente`SELECT count(*)::int AS n FROM drizzle.__drizzle_migrations`;
    if (!linha || linha.n < 1) {
      throw new Error('As migrations não foram registradas no banco de dados.');
    }
  } finally {
    if (typeof cliente.end === 'function') await cliente.end();
  }
}
