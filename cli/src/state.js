import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdir, open, readFile, rename, rm } from 'node:fs/promises';
import { join } from 'node:path';

const LOCK_NAME = 'install.lock';
const STATE_NAME = 'install-state.json';

function aplicarAclWindows(caminho) {
  if (process.platform !== 'win32') return;
  const usuario = process.env.USERNAME;
  if (!usuario) throw new Error('USERNAME não está definido para proteger os arquivos da instalação.');
  const resultado = spawnSync(
    'icacls',
    [caminho, '/inheritance:r', '/grant:r', `${usuario}:(OI)(CI)F`, 'SYSTEM:(OI)(CI)F'],
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
    try {
      await rm(lockPath, { force: true });
    } catch (error) {
      if (error?.code !== 'EPERM') throw error;
      // ponytail: Windows AV can hold lock file briefly after close; retry once after small delay
      await new Promise((resolve) => setTimeout(resolve, 50));
      try {
        await rm(lockPath, { force: true });
      } catch (retryError) {
        if (retryError?.code !== 'EPERM') throw retryError;
      }
    }
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
