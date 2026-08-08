import { createHash, randomUUID } from 'node:crypto';
import { copyFile, mkdir, open, readFile, readdir, rename, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';

export function versaoSegura(versao) {
  return typeof versao === 'string' && /^v?\d+\.\d+\.\d+$/.test(versao);
}

function semverPartes(versao) {
  const m = String(versao).match(/^v?(\d+)\.(\d+)\.(\d+)$/);
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

export function compararVersoes(a, b) {
  const pa = semverPartes(a);
  const pb = semverPartes(b);
  if (!pa || !pb) return String(a).localeCompare(String(b));
  for (let i = 0; i < 3; i += 1) {
    if (pa[i] !== pb[i]) return pa[i] - pb[i];
  }
  return 0;
}

export async function listarReleases(root) {
  const dir = join(root, 'releases');
  let entradas;
  try {
    entradas = await readdir(dir);
  } catch (error) {
    if (error?.code === 'ENOENT') return [];
    throw error;
  }
  return entradas.filter((v) => versaoSegura(v)).sort((a, b) => compararVersoes(b, a));
}

export async function podarReleases(root, { keep = 2 } = {}) {
  const lista = await listarReleases(root);
  const excedentes = lista.slice(keep);
  for (const versao of excedentes) {
    await rm(join(root, 'releases', versao), { recursive: true, force: true });
    await rm(join(root, 'downloads', 'releases', versao), { recursive: true, force: true });
  }
  return { removidas: excedentes, mantidas: lista.slice(0, keep) };
}

import { redigirUri, sanitizarErro } from './secrets.js';
import { escreverArquivoAtomicamente, lerArquivoJson } from './state.js';

function linhas(saida) {
  return String(saida ?? '').split('\n').filter((linha) => linha.trim() !== '');
}

function nomeInseguro(nome, platform) {
  if (nome === '') return 'nome vazio';
  if (nome.includes('\0')) return 'nome com byte nulo';
  const normalizado = nome.replaceAll('\\', '/');
  if (normalizado.startsWith('/') || (platform === 'win32' && /^[A-Za-z]:\//.test(normalizado))) {
    return 'caminho absoluto';
  }
  if (normalizado.split('/').includes('..')) return 'subida de diretório';
  return null;
}

export function validarListagem({ nomes, tipos, platform = process.platform }) {
  for (const nome of nomes) {
    const problema = nomeInseguro(nome, platform);
    if (problema) {
      throw new Error(`Arquivo do GerontiCare inseguro: ${problema} ("${nome}").`);
    }
  }
  for (const tipo of tipos) {
    if (tipo !== '-' && tipo !== 'd') {
      throw new Error('O arquivo do GerontiCare contém links ou entradas inseguras.');
    }
  }
}

export function parsearSha256(conteudo) {
  const token = String(conteudo).trim().split(/\s+/)[0];
  if (!token) throw new Error('Arquivo .sha256 do GerontiCare vazio ou inválido.');
  return token.toLowerCase();
}

async function hashSha256(caminho) {
  const hash = createHash('sha256');
  const arquivo = await open(caminho, 'r');
  const buffer = Buffer.allocUnsafe(1024 * 1024);
  try {
    for (;;) {
      const { bytesRead } = await arquivo.read(buffer, 0, buffer.length, null);
      if (bytesRead === 0) break;
      hash.update(bytesRead === buffer.length ? buffer : buffer.subarray(0, bytesRead));
    }
  } finally {
    await arquivo.close();
  }
  return hash.digest('hex');
}

export async function baixarArquivo({ url, destino, fetchFn, sinal }) {
  const resposta = await fetchFn(url, sinal ? { signal: sinal } : undefined);
  if (!resposta?.ok) {
    throw new Error(`Falha ao baixar ${redigirUri(url)} (HTTP ${resposta?.status ?? 'desconhecido'}).`);
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

async function executarSpawn(spawnFn, args, sinal) {
  const resultado = await spawnFn(args, sinal ? { signal: sinal } : undefined);
  if (resultado.exitCode !== 0) {
    throw new Error(`Falha ao executar "${args[0]}" (código ${resultado.exitCode}).`);
  }
  return resultado;
}

export async function comandoNpm({ spawnFn, args, cwd, env, platform = process.platform, sinal }) {
  const comando = platform === 'win32'
    ? [process.execPath, join(dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js'), ...args]
    : ['npm', ...args];
  const resultado = await spawnFn(comando, { cwd, env, ...(sinal ? { signal: sinal } : {}) });
  if (resultado.exitCode !== 0) {
    const rotulo = args[0] === 'run' ? args[1] : args[0];
    throw new Error(`Falha ao executar "npm ${rotulo}" no pacote do GerontiCare: ${ultimaLinha(resultado)}`);
  }
  return resultado;
}

function ultimaLinha(resultado) {
  const saida = String(resultado.stderr ?? resultado.stdout ?? '').trim().split('\n').filter(Boolean);
  const linha = saida.at(-1) ?? 'saída vazia';
  return linha.length > 300 ? `${linha.slice(0, 300)}…` : linha;
}

async function releaseReutilizavel(releaseDir, nomeTar) {
  const marker = await lerArquivoJson(releaseDir, 'verified.json');
  if (!marker || !marker.sha256 || marker.arquivo !== nomeTar) return false;
  try {
    const sha256 = await hashSha256(join(releaseDir, nomeTar));
    return sha256 === marker.sha256;
  } catch (error) {
    if (error?.code === 'ENOENT') return false;
    throw error;
  }
}

export async function releaseInstaladaValida({ root, versao }) {
  const releaseDir = join(root, 'releases', versao);
  const nomeTar = `geronticare-app-v${versao}.tar.gz`;
  return releaseReutilizavel(releaseDir, nomeTar);
}

async function assetVerificado(dir, nomeTar) {
  const marker = await lerArquivoJson(dir, 'verified.json');
  if (!marker || marker.arquivo !== nomeTar || !marker.sha256) return false;
  try {
    await readFile(join(dir, nomeTar.replace(/\.tar\.gz$/, '.sha256')));
    return await hashSha256(join(dir, nomeTar)) === marker.sha256;
  } catch (error) {
    if (error?.code === 'ENOENT') return false;
    throw error;
  }
}

export async function prepararRelease({
  root,
  versao,
  porta,
  github = { repo: 'claudioorjunior/geronticare' },
  fetchFn = fetch,
  spawnFn,
  log = console.log,
  sinal,
}) {
  const releasesDir = join(root, 'releases');
  const releaseDir = join(releasesDir, versao);
  const cacheDir = join(root, 'downloads', 'releases', versao);
  const urlApp = `http://127.0.0.1:${porta}`;
  const nomeTar = `geronticare-app-v${versao}.tar.gz`;
  const nomeSha = `geronticare-app-v${versao}.sha256`;
  const baseUrl = `https://github.com/${github.repo}/releases/download/v${versao}`;

  if (await releaseReutilizavel(releaseDir, nomeTar)) {
    log(`Release v${versao} já verificado; pulando download.`);
    return { releaseDir, baixado: false };
  }

  if (await lerArquivoJson(releaseDir, 'verified.json')) {
    throw new Error(`A release v${versao} existente não pode ser substituída com segurança. Rode o doctor.`);
  }

  const staging = join(root, 'staging', randomUUID());
  try {
    await mkdir(staging, { recursive: true, mode: 0o700 });
    const tarStaging = join(staging, nomeTar);
    const shaStaging = join(staging, nomeSha);
    const cacheTar = join(cacheDir, nomeTar);
    const cacheSha = join(cacheDir, nomeSha);
    let baixado = false;

    if (!(await assetVerificado(cacheDir, nomeTar))) {
      log(`Baixando ${nomeTar}...`);
      await baixarArquivo({ url: `${baseUrl}/${nomeTar}`, destino: tarStaging, fetchFn, sinal });
      await baixarArquivo({ url: `${baseUrl}/${nomeSha}`, destino: shaStaging, fetchFn, sinal });

      const shaEsperado = parsearSha256(await readFile(shaStaging, 'utf8'));
      const sha256 = await hashSha256(tarStaging);
      if (sha256 !== shaEsperado) {
        throw new Error('Checksum do pacote do GerontiCare não confere com o arquivo .sha256.');
      }
      await mkdir(cacheDir, { recursive: true, mode: 0o700 });
      await copyFile(tarStaging, cacheTar);
      await copyFile(shaStaging, cacheSha);
      await escreverArquivoAtomicamente(cacheDir, 'verified.json', {
        versao,
        arquivo: nomeTar,
        sha256,
      });
      baixado = true;
    }

    const destinoApp = join(staging, 'app');
    await mkdir(destinoApp, { mode: 0o700 });

    const tarFonte = await assetVerificado(cacheDir, nomeTar) ? cacheTar : tarStaging;
    const nomes = linhas((await executarSpawn(spawnFn, ['tar', '-tzf', tarFonte], sinal)).stdout);
    const tipos = linhas((await executarSpawn(spawnFn, ['tar', '-tvf', tarFonte], sinal)).stdout)
      .map((linha) => linha.split(/\s+/)[0]?.[0] ?? '');
    validarListagem({ nomes, tipos });

    log('Extraindo e compilando o pacote...');
    await executarSpawn(
      spawnFn,
      ['tar', '-xzf', tarFonte, '-C', destinoApp, '--no-same-owner', '--no-same-permissions'],
      sinal,
    );

    const envBuild = { ...process.env, NEXT_PUBLIC_APP_URL: urlApp };
    await comandoNpm({ spawnFn, args: ['ci'], cwd: destinoApp, env: envBuild, sinal });
    await comandoNpm({ spawnFn, args: ['run', 'build', '--', '--webpack'], cwd: destinoApp, env: envBuild, sinal });

    await mkdir(releasesDir, { recursive: true, mode: 0o700 });
    try {
      await readFile(join(releaseDir, 'verified.json'));
      throw new Error(`A release v${versao} foi criada por outro processo. Rode o doctor.`);
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
    }
    const releaseStaging = join(staging, 'release');
    await rename(destinoApp, releaseStaging);
    await copyFile(cacheTar, join(releaseStaging, nomeTar));
    await copyFile(cacheSha, join(releaseStaging, nomeSha));
    const sha256 = await hashSha256(cacheTar);
    await escreverArquivoAtomicamente(releaseStaging, 'verified.json', {
      versao,
      arquivo: nomeTar,
      sha256,
      nextPublicAppUrl: urlApp,
    });
    await rename(releaseStaging, releaseDir);

    await rm(staging, { recursive: true, force: true });
    return { releaseDir, baixado };
  } catch (error) {
    await rm(staging, { recursive: true, force: true }).catch(() => {});
    throw new Error(sanitizarErro(error));
  }
}
