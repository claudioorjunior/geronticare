import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { readFile, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

import { lerPid } from './state.js';

import { conectarPorta as conectarPortaCompartilhada } from './porta.js';
import { redigirUri, sanitizarErro } from './secrets.js';

const FASES = new Set([
  'NEW', 'PREFLIGHT', 'DATABASE_SELECTED', 'DATABASE_READY', 'RELEASE_VERIFIED',
  'APP_BUILT', 'CONFIGURED', 'MIGRATED', 'SERVER_READY', 'BOOTSTRAP_PENDING', 'READY',
]);

const VERSAO_MAJOR_VALIDAS = new Set([16, 17, 18]);

function conectarPortaPadrao(porta) {
  return conectarPortaCompartilhada(porta);
}

function versaoSegura(versao) {
  return typeof versao === 'string' && /^v?\d+\.\d+\.\d+$/.test(versao);
}

async function lerArquivo(root, nome) {
  try {
    return await readFile(join(root, nome), 'utf8');
  } catch (error) {
    if (error?.code === 'ENOENT') return null;
    throw error;
  }
}

async function verificarPermissoes(root) {
  if (process.platform === 'win32') {
    const resultado = spawnSync('icacls', [root], { encoding: 'utf8', windowsHide: true });
    if (resultado.status !== 0) return { ok: false, detalhe: 'não foi possível ler as ACLs da instalação' };
    const acl = `${resultado.stdout ?? ''}\n${resultado.stderr ?? ''}`;
    if (/(Everyone|Todos|BUILTIN\\Users|BUILTIN\\Administrators)/i.test(acl)) {
      return { ok: false, detalhe: 'a ACL da instalação inclui um grupo amplo' };
    }
    return { ok: true, detalhe: 'ACL limitada ao usuário da instalação e SYSTEM' };
  }
  try {
    const raiz = await stat(root);
    if ((raiz.mode & 0o077) !== 0) {
      return { ok: false, detalhe: 'o diretório da instalação permite acesso de grupo ou outros' };
    }
  } catch (error) {
    if (error?.code === 'ENOENT') return { ok: false, detalhe: 'diretório da instalação ausente' };
    return { ok: false, detalhe: sanitizarErro(error) };
  }

  try {
    const segredo = await stat(join(root, 'secrets.json'));
    if ((segredo.mode & 0o077) !== 0) {
      return { ok: false, detalhe: 'secrets.json permite acesso de grupo ou outros' };
    }
  } catch (error) {
    if (error?.code !== 'ENOENT') return { ok: false, detalhe: sanitizarErro(error) };
  }
  return { ok: true, detalhe: 'diretório e segredos com permissões restritas' };
}

function redigirMensagem(mensagem) {
  return mensagem.replace(/[a-z][a-z0-9+.-]*:\/\/[^\s"'<>]+/gi, (uri) => redigirUri(uri));
}

export async function executarDoctor({
  root,
  config,
  segredos,
  criarCliente,
  fetchFn,
  log = console.log,
  conectarPorta = conectarPortaPadrao,
} = {}) {
  const resultados = [];

  // 1. lock (somente leitura; nunca remover).
  const lockConteudo = await lerArquivo(root, 'install.lock');
  let lockIndice = -1;
  if (lockConteudo === null) {
    resultados.push({
      chave: 'lock', nome: 'Lock de instalação', ok: true, detalhe: 'sem lock de instalação',
    });
    lockIndice = resultados.length - 1;
  } else {
    const pid = Number.parseInt(lockConteudo.trim(), 10);
    let ativo = false;
    if (Number.isInteger(pid)) {
      try {
        process.kill(pid, 0);
        ativo = true;
      } catch (error) {
        ativo = error?.code !== 'ESRCH';
      }
    }
    resultados.push({
      chave: 'lock', nome: 'Lock de instalação', ok: !ativo,
      detalhe: ativo
        ? `outra instalação em execução (PID ${pid})`
        : 'lock presente, mas o processo não está ativo',
    });
    lockIndice = resultados.length - 1;
  }

  const permissoes = await verificarPermissoes(root);
  resultados.push({ chave: 'permissoes', nome: 'Permissões da instalação', ...permissoes });

  // 2. estado.
  const estadoConteudo = await lerArquivo(root, 'install-state.json');
  let estado = null;
  let detalheEstado;
  if (estadoConteudo === null) {
    detalheEstado = 'sem estado de instalação';
  } else {
    try {
      estado = JSON.parse(estadoConteudo);
    } catch {
      detalheEstado = 'install-state.json inválido';
    }
  }
  const faseValida = Boolean(estado && typeof estado === 'object' && FASES.has(estado.fase));
  resultados.push({
    chave: 'estado', nome: 'Estado de instalação', ok: faseValida,
    detalhe: faseValida
      ? `fase ${estado.fase}`
      : (detalheEstado ?? `fase desconhecida: ${estado?.fase ?? 'ausente'}`),
  });

  // 3. release verificada (sha256 recalculado do asset).
  const versao = config?.versao ?? estado?.versao;
  if (!versao) {
    resultados.push({
      chave: 'release', nome: 'Release verificada', ok: false, detalhe: 'sem versão configurada',
    });
  } else if (!versaoSegura(versao)) {
    resultados.push({
      chave: 'release', nome: 'Release verificada', ok: false, detalhe: 'versão inválida no estado da instalação',
    });
  } else {
    const releaseDir = join(root, 'releases', versao);
    const verificado = await lerArquivo(releaseDir, 'verified.json');
    if (verificado === null) {
      resultados.push({
        chave: 'release', nome: 'Release verificada', ok: false,
        detalhe: `release ${versao} não encontrada (verifique releases/${versao}/verified.json)`,
      });
    } else {
      try {
        const meta = JSON.parse(verificado);
        if (typeof meta.arquivo !== 'string' || /[\\/\0]/.test(meta.arquivo)) {
          throw new Error('nome do arquivo da release inválido');
        }
        const asset = await readFile(join(releaseDir, meta.arquivo));
        const hash = createHash('sha256').update(asset).digest('hex');
        const ok = hash === meta.sha256;
        resultados.push({
          chave: 'release', nome: 'Release verificada', ok,
          detalhe: ok ? `release ${versao} íntegra` : 'sha256 não confere com o arquivo da release',
        });
      } catch (error) {
        resultados.push({
          chave: 'release', nome: 'Release verificada', ok: false,
          detalhe: `arquivo da release ausente ou inválido (${redigirMensagem(sanitizarErro(error))})`,
        });
      }
    }
  }

  // 4. porta (leitura: apenas verifica se algo escuta).
  let portaAberta = null;
  if (config?.porta == null) {
    resultados.push({
      chave: 'porta', nome: 'Porta do servidor', ok: true, detalhe: 'sem porta configurada',
    });
  } else {
    portaAberta = await conectarPorta(config.porta);
    resultados.push({
      chave: 'porta', nome: 'Porta do servidor', ok: portaAberta,
      detalhe: portaAberta
        ? `servidor ativo em 127.0.0.1:${config.porta}`
        : `nenhum servidor ouvindo em 127.0.0.1:${config.porta}`,
    });
  }

  // 5. processo.
  if (portaAberta === null) {
    resultados.push({
      chave: 'processo', nome: 'Processo do servidor', ok: true, detalhe: 'sem porta configurada',
    });
  } else if (portaAberta) {
    try {
      const health = await fetchFn(`http://127.0.0.1:${config.porta}/api/health`);
      resultados.push({
        chave: 'processo', nome: 'Processo do servidor', ok: health.ok,
        detalhe: health.ok ? 'GET /api/health respondeu' : 'GET /api/health falhou',
      });
    } catch (error) {
      resultados.push({
        chave: 'processo', nome: 'Processo do servidor', ok: false,
        detalhe: redigirMensagem(sanitizarErro(error)),
      });
    }
  } else {
    resultados.push({
      chave: 'processo', nome: 'Processo do servidor', ok: false, detalhe: 'servidor não está rodando',
    });
  }

  // 6. banco.
  let cliente = null;
  if (segredos?.DATABASE_URL) {
    try {
      cliente = await criarCliente(segredos.DATABASE_URL);
      await cliente`SELECT 1`;
      resultados.push({
        chave: 'banco', nome: 'Conexão com o banco', ok: true,
        detalhe: `conectado em ${redigirUri(segredos.DATABASE_URL)}`,
      });
    } catch (error) {
      resultados.push({
        chave: 'banco', nome: 'Conexão com o banco', ok: false,
        detalhe: redigirMensagem(sanitizarErro(error)),
      });
    }
  } else {
    resultados.push({
      chave: 'banco', nome: 'Conexão com o banco', ok: true, detalhe: 'sem DATABASE_URL configurado',
    });
  }

  // 7. versão do PostgreSQL.
  try {
    const linhas = cliente
      ? await cliente`SELECT current_setting('server_version')`
      : [];
    const versaoPostgres = String(linhas?.[0]?.current_setting ?? '');
    const major = Number.parseInt(versaoPostgres, 10);
    const ok = VERSAO_MAJOR_VALIDAS.has(major);
    resultados.push({
      chave: 'versao', nome: 'Versão do PostgreSQL', ok,
      detalhe: ok
        ? `PostgreSQL ${versaoPostgres}`
        : `versão não suportada: ${versaoPostgres || 'desconhecida'}`,
    });
  } catch (error) {
    resultados.push({
      chave: 'versao', nome: 'Versão do PostgreSQL', ok: false,
      detalhe: redigirMensagem(sanitizarErro(error)),
    });
  }

  // 8. migrations.
  try {
    if (!cliente) throw new Error('Banco de dados não configurado.');
    const linhas = await cliente`SELECT count(*) AS n FROM drizzle.__drizzle_migrations`;
    const n = Number(linhas?.[0]?.n ?? 0);
    if (n < 1) throw new Error('Nenhuma migration aplicada.');
    resultados.push({
      chave: 'migrations', nome: 'Migrations', ok: true,
      detalhe: `${n} ${n === 1 ? 'migração aplicada' : 'migrations aplicadas'}`,
    });
  } catch {
    resultados.push({
      chave: 'migrations', nome: 'Migrations', ok: false, detalhe: 'migrations ausentes',
    });
  }

  if (cliente && typeof cliente.end === 'function') {
    try {
      await cliente.end();
    } catch {
      // encerrar a conexão é best-effort no doctor (somente leitura).
    }
  }

  // 9. bootstrap.
  if (portaAberta !== true) {
    resultados.push({
      chave: 'bootstrap', nome: 'Bootstrap', ok: true, detalhe: 'servidor não está rodando',
    });
  } else {
    try {
      const cabecalhos = segredos?.SETUP_TOKEN
        ? { headers: { Authorization: `Bearer ${segredos.SETUP_TOKEN}` } }
        : undefined;
      const resposta = await fetchFn(
        `http://127.0.0.1:${config.porta}/api/setup`,
        cabecalhos,
      );
      const estadoSetup = await resposta.json();
      const inconsistente = estadoSetup?.inconsistente === true;
      resultados.push({
        chave: 'bootstrap', nome: 'Bootstrap', ok: resposta.ok && !inconsistente,
        detalhe: inconsistente
          ? 'bootstrap inconsistente; recuperação manual necessária'
          : resposta.ok
            ? `necessario=${String(estadoSetup.necessario)}`
          : `GET /api/setup falhou (status ${resposta.status ?? '?'})`,
      });
    } catch (error) {
      resultados.push({
        chave: 'bootstrap', nome: 'Bootstrap', ok: false,
        detalhe: redigirMensagem(sanitizarErro(error)),
      });
    }
  }

  const lockAtivo = lockIndice >= 0 && !resultados[lockIndice].ok;
  const servidorSaudavel = portaAberta === true
    && resultados.some((r) => r.chave === 'processo' && r.ok)
    && resultados.some((r) => r.chave === 'banco' && r.ok);
  if (lockAtivo && servidorSaudavel) {
    resultados[lockIndice] = {
      chave: 'lock',
      nome: 'Lock de instalação',
      ok: true,
      detalhe: `lock presente com servidor ativo (PID ${lockConteudo.trim()}); instalação já concluída`,
    };
  }

  const pid = await lerPid(root);
  if (pid === null) {
    resultados.push({ chave: 'pid', nome: 'Servidor background', ok: true, detalhe: 'sem server.pid' });
  } else {
    let vivo = false;
    try { process.kill(pid, 0); vivo = true; } catch (e) { vivo = e?.code !== 'ESRCH'; }
    resultados.push({ chave: 'pid', nome: 'Servidor background', ok: !vivo || portaAberta === true, detalhe: vivo ? `PID ${pid} ativo` : `PID ${pid} stale` });
  }
  try {
    const releases = await readdir(join(root, 'releases'));
    const validas = releases.filter((v) => /^v?\d+\.\d+\.\d+$/.test(v));
    resultados.push({ chave: 'releases', nome: 'Releases retidas', ok: validas.length >= 1 && validas.length <= 5, detalhe: `${validas.length} release(s) retida(s)` });
  } catch {
    resultados.push({ chave: 'releases', nome: 'Releases retidas', ok: true, detalhe: 'sem releases' });
  }
  try {
    await stat(join(root, 'logs', 'server.log'));
    resultados.push({ chave: 'logs', nome: 'Logs', ok: true, detalhe: 'logs/server.log presente' });
  } catch (error) {
    if (error?.code === 'ENOENT') resultados.push({ chave: 'logs', nome: 'Logs', ok: true, detalhe: 'sem logs ainda' });
    else resultados.push({ chave: 'logs', nome: 'Logs', ok: false, detalhe: sanitizarErro(error) });
  }

  for (const resultado of resultados) {
    log(`[${resultado.ok ? 'ok' : 'FALHA'}] ${resultado.nome}: ${resultado.detalhe}`);
  }
  return resultados;
}
