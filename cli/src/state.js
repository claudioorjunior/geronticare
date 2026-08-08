import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { statSync } from 'node:fs';
import { mkdir, open, readFile, rename, rm } from 'node:fs/promises';
import { join } from 'node:path';

export function caminhoPid(root) {
  return join(root, 'server.pid');
}

export async function lerPid(root) {
  try {
    const conteudo = await readFile(caminhoPid(root), 'utf8');
    const pid = Number.parseInt(conteudo.trim(), 10);
    if (!Number.isInteger(pid)) return null;
    return pid;
  } catch (error) {
    if (error?.code === 'ENOENT') return null;
    throw error;
  }
}

export async function escreverPid(root, pid) {
  await mkdir(root, { recursive: true, mode: 0o700 });
  aplicarAclWindows(root);
  const destino = caminhoPid(root);
  const temporario = `${destino}.${process.pid}.${randomUUID()}.tmp`;
  const arquivo = await open(temporario, 'wx', 0o600);
  try {
    await arquivo.writeFile(`${pid}\n`);
    await arquivo.sync();
  } finally {
    await arquivo.close();
  }
  try {
    try {
      await rename(temporario, destino);
    } catch (error) {
      if (error?.code !== 'EPERM' && error?.code !== 'EEXIST') throw error;
      await rm(destino, { force: true });
      await rename(temporario, destino);
    }
    aplicarAclWindows(destino);
    if (process.platform !== 'win32') {
      const diretorio = await open(root, 'r');
      try {
        await diretorio.sync();
      } finally {
        await diretorio.close();
      }
    }
  } catch (error) {
    await rm(temporario, { force: true });
    throw error;
  }
}

export async function removerPid(root) {
  await rm(caminhoPid(root), { force: true });
}

const LOCK_NAME = 'install.lock';
const STATE_NAME = 'install-state.json';
const WINDOWS_LOCK_RETRY_DELAYS_MS = [25, 50, 100, 200, 400];

function aplicarAclWindows(caminho) {
  if (process.platform !== 'win32') return;
  const usuario = process.env.USERNAME;
  if (!usuario) throw new Error('USERNAME não está definido para proteger os arquivos da instalação.');
  const regras = statSync(caminho).isDirectory()
    ? [`${usuario}:F`, `${usuario}:(OI)(CI)F`, 'SYSTEM:F', 'SYSTEM:(OI)(CI)F']
    : [`${usuario}:F`, 'SYSTEM:F'];
  const resultado = spawnSync(
    'icacls',
    [caminho, '/inheritance:r', '/grant:r', ...regras],
    { encoding: 'utf8', windowsHide: true },
  );
  if (resultado.status !== 0) {
    throw new Error('Não foi possível restringir as permissões ACL da instalação.');
  }
}

async function processoExiste(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if (error?.code === 'ESRCH') return false;
    return true;
  }
}

async function removerLock(lockPath) {
  for (const atraso of [0, ...WINDOWS_LOCK_RETRY_DELAYS_MS]) {
    if (atraso > 0) await new Promise((resolve) => setTimeout(resolve, atraso));
    try {
      await rm(lockPath, { force: true });
      return;
    } catch (error) {
      const bloqueioTemporario = process.platform === 'win32'
        && (error?.code === 'EPERM' || error?.code === 'EBUSY');
      if (!bloqueioTemporario || atraso === WINDOWS_LOCK_RETRY_DELAYS_MS.at(-1)) throw error;
    }
  }
}

async function abrirLock(root, pid = process.pid) {
  const lockPath = join(root, LOCK_NAME);

  try {
    const lock = await open(lockPath, 'wx', 0o600);
    await lock.writeFile(`${pid}\n`);
    await lock.sync();
    return lock;
  } catch (error) {
    if (error?.code !== 'EEXIST') throw error;
  }

  const pidExistente = Number.parseInt(await readFile(lockPath, 'utf8'), 10);
  if (Number.isInteger(pidExistente) && await processoExiste(pidExistente)) {
    throw new Error('Outra instalação do GerontiCare já está em execução.');
  }

  // ponytail: recuperação por PID basta; trocar por lock nativo se contenção multiprocessos virar problema real.
  await rm(lockPath, { force: true });
  try {
    const lock = await open(lockPath, 'wx', 0o600);
    await lock.writeFile(`${pid}\n`);
    await lock.sync();
    return lock;
  } catch (error) {
    if (error?.code === 'EEXIST') {
      throw new Error('Outra instalação do GerontiCare já está em execução.');
    }
    throw error;
  }
}

export async function comInstallLock(root, executar) {
  await mkdir(root, { recursive: true, mode: 0o700 });
  aplicarAclWindows(root);
  const lockPath = join(root, LOCK_NAME);
  const lock = await abrirLock(root);

  try {
    return await executar();
  } finally {
    await lock.close();
    // Windows Defender/indexers can retain the just-closed handle briefly. Do not
    // leave a live-PID lock behind: it would make the following smoke test look
    // like a concurrent installation.
    await removerLock(lockPath);
  }
}

export async function escreverArquivoAtomicamente(root, nome, dados) {
  await mkdir(root, { recursive: true, mode: 0o700 });
  aplicarAclWindows(root);
  const destino = join(root, nome);
  const temporario = `${destino}.${process.pid}.${randomUUID()}.tmp`;
  const arquivo = await open(temporario, 'wx', 0o600);

  try {
    await arquivo.writeFile(`${JSON.stringify(dados, null, 2)}\n`);
    await arquivo.sync();
  } finally {
    await arquivo.close();
  }

  try {
    try {
      await rename(temporario, destino);
    } catch (error) {
      if (error?.code !== 'EPERM' && error?.code !== 'EEXIST') throw error;
      // ponytail: Windows rename does not overwrite existing dest (EPERM/EEXIST); remove and retry
      await rm(destino, { force: true });
      await rename(temporario, destino);
    }
    aplicarAclWindows(destino);
    if (process.platform !== 'win32') {
      const diretorio = await open(root, 'r');
      try {
        await diretorio.sync();
      } finally {
        await diretorio.close();
      }
    }
  } catch (error) {
    await rm(temporario, { force: true });
    throw error;
  }
}

export async function escreverEstado(root, estado) {
  await escreverArquivoAtomicamente(root, STATE_NAME, estado);
}

export async function lerArquivoJson(root, nome) {
  try {
    const conteudo = await readFile(join(root, nome), 'utf8');
    const estado = JSON.parse(conteudo);
    if (typeof estado !== 'object' || estado === null || Array.isArray(estado)) {
      return null;
    }
    return estado;
  } catch (error) {
    if (error?.code === 'ENOENT') return null;
    if (error instanceof SyntaxError) return null;
    throw error;
  }
}

export async function lerEstado(root) {
  const estado = await lerArquivoJson(root, STATE_NAME);
  if (estado === null) return null;
  const fases = new Set([
    'NEW', 'PREFLIGHT', 'DATABASE_SELECTED', 'DATABASE_READY', 'RELEASE_VERIFIED',
    'APP_BUILT', 'CONFIGURED', 'MIGRATED', 'SERVER_READY', 'BOOTSTRAP_PENDING', 'READY',
  ]);
  if (typeof estado.fase !== 'string' || !fases.has(estado.fase)) {
    throw new Error('install-state.json inválido ou em fase desconhecida. Rode o doctor.');
  }
  return estado;
}
