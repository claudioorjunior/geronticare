import { spawn } from 'node:child_process';
import { open, readFile, statfs as statfsPromises } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { release as osRelease } from 'node:os';

import { resolverHome } from './cli.js';
import { configurarBanco } from './db/index.js';
import { PORTA_POSTGRES_PADRAO, validarDistroLinux } from './db/local.js';
import { criarClientePostgres, provarComCliente } from './db/validacao.js';
import { executarDoctor } from './doctor.js';
import { conectarPorta, escolherPorta } from './porta.js';
import { backupAntesDeMigrar } from './backup.js';
import { compararVersoes, listarReleases, podarReleases, prepararRelease, releaseInstaladaValida, versaoSegura } from './release.js';
import { formatarAviso, verificarAtualizacao } from './update-check.js';
import {
  ambientePostgres,
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
  iniciarServidorDetached,
  lerLogs,
  monitorarBootstrap,
  pararServidorDetached,
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
  conectarPortaFn,
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
  versaoAlvo = null,
  fundo = false,
  linhasLog = 100,
  seguirLog = false,
  nodeVersion = process.version,
  isTTY = process.stdin.isTTY === true,
} = {}) {
  const root = resolverHome({ env, platform, home });
  const servicos = {
    ui, root, env, platform, arquitetura, fetchFn, executar, spawnFn,
    versaoSistema,
    registrarSinal, abrirNavegador, criarCliente, portaLivreFn,
    conectarPortaFn: conectarPortaFn ?? conectarPorta,
    criarServidorHttp,
    baixar,
    hashFn,
    fsBanco,
    distroId,
    distroVersion,
    versao: versao ?? await lerVersaoPackage(),
  };

  if (comando === 'doctor') {
    await diagnosticar({ ...servicos, isTTY });
    await notificarAtualizacao({ root, fetchFn, ui, estado: await lerEstado(root), config: await lerArquivoJson(root, 'config.json') });
    return;
  }
  if (comando === 'stop') {
    return pararServidorDetached({ root, log: ui.log });
  }
  if (comando === 'logs') {
    return lerLogs({ root, n: linhasLog, log: ui.log, seguir: seguirLog, spawnFn });
  }
  if (comando === 'upgrade') {
    return comInstallLock(root, () => upgradeFluxo({ ...servicos, versaoAlvo }));
  }
  if (comando === 'rollback') {
    return comInstallLock(root, () => rollbackFluxo({ ...servicos, versaoAlvo }));
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
      resultadoStart = await instalarOuIniciar({ ...servicosStart, somenteIniciar: true, fundo });
    });
    await notificarAtualizacao({ root, fetchFn, ui, estado: await lerEstado(root), config: await lerArquivoJson(root, 'config.json'), fallbackVersao: versaoEfetiva });
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
  await comInstallLock(root, () => instalarOuIniciar({ ...servicosInstalacao, portaInicial, fundo }));
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
  distroId, distroVersion, fundo = false,
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
    if (ordemFase > 4 && !(await releaseInstaladaValida({ root, versao }))) {
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

    if (fundo) {
      const releaseDirFundo = join(root, 'releases', versao);
      await pararServidorDetached({ root, log: () => {} }).catch(() => {});
      if (filho) {
        await encerrarFilho({ filho, saida: saidaServidor }).catch(() => {});
      }
      const configFundo = (await lerArquivoJson(root, 'config.json')) ?? { host: '127.0.0.1', porta, versao };
      const segredosFundo = (await lerSegredos(root)) ?? segredosAtuais;
      await iniciarServidorDetached({ releaseDir: releaseDirFundo, config: configFundo, segredos: segredosFundo, spawnFn, log: ui.log });
      ui.log(`GerontiCare em background em http://127.0.0.1:${porta}. Use 'geronticare logs' e 'geronticare stop'.`);
      servidorEncerrado = true;
      return;
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

async function resolverVersaoAlvo({ versaoAlvo, fetchFn }) {
  if (versaoAlvo) {
    const v = String(versaoAlvo).replace(/^v/, '');
    if (!versaoSegura(v)) throw new Error(`Versão inválida: ${versaoAlvo}. Use X.Y.Z.`);
    return v;
  }
  const resposta = await fetchFn('https://api.github.com/repos/claudioorjunior/geronticare/releases/latest');
  if (!resposta.ok) throw new Error('Não foi possível resolver a versão mais recente.');
  const dados = await resposta.json();
  const tag = String(dados.tag_name ?? dados.name ?? '').replace(/^v/, '');
  if (!versaoSegura(tag)) throw new Error('Versão latest inválida retornada pelo GitHub.');
  return tag;
}

async function upgradeFluxo({ root, ui, fetchFn, executar, spawnFn, versaoAlvo, conectarPortaFn }) {
  const chkPorta = conectarPortaFn ?? conectarPorta;
  const estado = await lerEstado(root);
  if (!estado || estado.fase !== 'READY') throw new Error('Instalação não está em READY. Rode o instalador primeiro.');
  const config = await lerArquivoJson(root, 'config.json');
  const segredos = await lerSegredos(root);
  if (!config || !segredos?.DATABASE_URL) throw new Error('config/secrets ausentes para upgrade.');
  const alvo = await resolverVersaoAlvo({ versaoAlvo, fetchFn });
  if (alvo === config.versao) throw new Error(`Já está na versão ${alvo}.`);
  if (compararVersoes(alvo, config.versao) < 0) throw new Error(`upgrade exige versão maior que ${config.versao}; use rollback para voltar.`);
  ui.log(`Atualizando de v${config.versao} para v${alvo}...`);
  const configAnterior = { ...config };
  const versaoAnterior = config.versao;
  // ponytail: backup + preparo com servidor ainda no ar (downtime só no cutover);
  // guarda antes de mudanças irreversíveis (migrate).
  await backupAntesDeMigrar({ root, config, segredos, executar, log: ui.log });
  await prepararRelease({ root, versao: alvo, porta: config.porta, fetchFn, spawnFn: executar, log: ui.log });
  const parado = await pararServidorDetached({ root, log: () => {} }).catch(() => ({ parado: false }));
  if (!parado.parado) {
    const portaOcupada = await chkPorta(config.porta);
    if (portaOcupada) {
      throw new Error('Servidor não está em modo gerenciado (server.pid ausente/inativo); pare-o com `geronticare stop` antes de atualizar.');
    }
  }
  // migrate + cutover com recuperação única; bookkeeping fora do catch (falha pós-cutover não reverte servidor saudável)
  let cutoverFalhou = false;
  try {
    const releaseDir = join(root, 'releases', alvo);
    const resultado = await executar([process.execPath, join(releaseDir, 'scripts', 'migrate.mjs')], { cwd: releaseDir, env: { ...process.env, DATABASE_URL: segredos.DATABASE_URL } });
    if (resultado.exitCode !== 0) throw new Error('Falha ao aplicar migrations do upgrade.');
    try {
      const segredosAtuais = await lerSegredos(root);
      await iniciarServidorDetached({ releaseDir, config: { ...config, versao: alvo }, segredos: segredosAtuais, spawnFn, log: ui.log });
      await aguardarProntidao({ porta: config.porta, fetchFn, log: ui.log });
    } catch (error) {
      cutoverFalhou = true;
      ui.log(`Aviso: cutover falhou (${sanitizarErro(error)}); restaurando v${versaoAnterior}.`);
      try {
        await pararServidorDetached({ root, log: () => {} }).catch(() => {});
        const releaseAnterior = join(root, 'releases', versaoAnterior);
        const segredosAtuais = await lerSegredos(root).catch(() => segredos);
        await iniciarServidorDetached({ releaseDir: releaseAnterior, config: configAnterior, segredos: segredosAtuais, spawnFn, log: () => {} }).catch(() => {});
      } catch {}
      throw error;
    }
  } catch (error) {
    if (cutoverFalhou) throw error;
    try {
      await pararServidorDetached({ root, log: () => {} }).catch(() => {});
      const releaseAnterior = join(root, 'releases', versaoAnterior);
      const segredosAtuais = await lerSegredos(root).catch(() => segredos);
      await iniciarServidorDetached({ releaseDir: releaseAnterior, config: configAnterior, segredos: segredosAtuais, spawnFn, log: () => {} }).catch(() => {});
      ui.log(`Aviso: falha na migration (${sanitizarErro(error)}); v${versaoAnterior} recolocada no ar.`);
    } catch {}
    throw error;
  }
  try {
    await escreverArquivoAtomicamente(root, 'config.json', { ...config, versao: alvo, ativo: true });
    await escreverEstado(root, { fase: 'READY', porta: config.porta, provedor: estado.provedor, versao: alvo, versaoAnterior });
    await podarReleases(root, { keep: 2 });
    ui.log(`Upgrade para v${alvo} concluído.`);
  } catch (error) {
    ui.log(`Aviso: servidor em v${alvo} já rodando, mas falha ao persistir estado (${sanitizarErro(error)}); rode doctor.`);
    throw error;
  }
}

async function rollbackFluxo({ root, ui, executar, versaoAlvo, spawnFn, conectarPortaFn }) {
  const estado = await lerEstado(root);
  if (!estado || estado.fase !== 'READY') throw new Error('Instalação não está em READY para rollback.');
  const config = await lerArquivoJson(root, 'config.json');
  if (!config) throw new Error('config.json ausente para rollback.');
  const releases = await listarReleases(root);
  if (releases.length < 2 && !versaoAlvo) throw new Error('Nenhuma versão anterior retida para rollback.');
  let alvo = versaoAlvo ? String(versaoAlvo).replace(/^v/, '') : releases.find((v) => v !== config.versao);
  if (!alvo) throw new Error('Versão alvo não encontrada.');
  if (!versaoSegura(alvo)) throw new Error(`Versão inválida: ${alvo}`);
  if (!releases.includes(alvo)) throw new Error(`Versão ${alvo} não está retida em releases/.`);
  const { readdir } = await import('node:fs/promises');
  let backupDir = null;
  try {
    const entradas = await readdir(join(root, 'backups'));
    const cand = entradas.filter((n) => n.endsWith(`-${alvo}`)).sort().reverse()[0];
    if (cand) backupDir = join(root, 'backups', cand);
  } catch {}
  const segredos = await lerSegredos(root);
  // Guarda antes do restore destrutivo; se já parado (stop manual / crash) permite seguir.
  const chkPortaRb = conectarPortaFn ?? conectarPorta;
  const parado = await pararServidorDetached({ root, log: () => {} }).catch(() => ({ parado: false }));
  if (!parado.parado) {
    const portaOcupada = await chkPortaRb(config.porta);
    if (portaOcupada) {
      throw new Error('Servidor não está em modo gerenciado (server.pid ausente/inativo); pare-o com `geronticare stop` antes do rollback.');
    }
    ui.log('Aviso: servidor já parado; prosseguindo com rollback.');
  }
  if (backupDir) {
    const dump = join(backupDir, 'dump.sql');
    // ponytail: restaura no schema public existente, que é recriado limpo antes
    // do replay; um banco dedicado ficaria preso no provedor cloud (Neon/Supabase).
    try {
      const sql = await import('node:fs/promises').then((m) => m.readFile(dump, 'utf8'));
      const limpar = 'DROP SCHEMA IF EXISTS public CASCADE;\nCREATE SCHEMA public;\nGRANT ALL ON SCHEMA public TO public;\n';
      const res = await executar(
        ['psql', '--single-transaction', '--set=ON_ERROR_STOP=1', '-f', '-'],
        { env: ambientePostgres(segredos.DATABASE_URL), input: `${limpar}${sql}` },
      );
      if (res.exitCode !== 0) {
        throw new Error(`Restore do banco falhou (código ${res.exitCode}); rollback de código abortado para não rodar a versão antiga sobre o schema atual.`);
      }
    } catch (error) {
      // Restore falhou com servidor já parado -> recoloca o atual no ar antes de abortar
      try {
        const segredosAtuais = await lerSegredos(root).catch(() => segredos);
        await iniciarServidorDetached({ releaseDir: join(root, 'releases', config.versao), config, segredos: segredosAtuais, spawnFn, log: () => {} }).catch(() => {});
      } catch {}
      throw new Error(`Rollback de banco indisponível: ${sanitizarErro(error)}`);
    }
  } else {
    ui.log('Aviso: sem backup de banco para esta versão; rollback só de código.');
  }
  const releaseDir = join(root, 'releases', alvo);
  const segredosAtuais = await lerSegredos(root);
  await iniciarServidorDetached({ releaseDir, config: { ...config, versao: alvo }, segredos: segredosAtuais, spawnFn, log: ui.log });
  await aguardarProntidao({ porta: config.porta, fetchFn: fetch, log: ui.log });
  await escreverArquivoAtomicamente(root, 'config.json', { ...config, versao: alvo });
  await escreverEstado(root, { fase: 'READY', porta: config.porta, provedor: estado.provedor, versao: alvo, versaoAnterior: config.versao });
  ui.log(`Rollback para v${alvo} concluído.`);
}

async function notificarAtualizacao({ root, fetchFn, ui, estado, config, fallbackVersao }) {
  const v = config?.versao ?? estado?.versao ?? fallbackVersao;
  if (!v) return;
  try {
    const info = await verificarAtualizacao({ root, versaoAtual: v, fetchFn });
    if (info) ui.log(formatarAviso(info));
  } catch {}
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
