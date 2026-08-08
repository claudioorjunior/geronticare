import { copyFile, mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { sanitizarErro } from './secrets.js';

export async function backupAntesDeMigrar({
  root,
  config,
  segredos,
  executar,
  log = console.log,
}) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dir = join(root, 'backups', `${stamp}-${config.versao}`);
  await mkdir(dir, { recursive: true, mode: 0o700 });
  try {
    await copyFile(join(root, 'config.json'), join(dir, 'config.json'));
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
  try {
    await copyFile(join(root, 'secrets.json'), join(dir, 'secrets.json'));
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
  const dumpPath = join(dir, 'dump.sql');
  try {
    const resultado = await executar(
      ['pg_dump', '--no-owner', '--format=plain', '-f', dumpPath, '--dbname', segredos.DATABASE_URL],
      { env: {} },
    );
    if (resultado.exitCode !== 0) {
      await import('node:fs/promises').then((m) => m.rm(dumpPath, { force: true })).catch(() => {});
      log(`Aviso: pg_dump falhou (código ${resultado.exitCode}); backup de banco não criado.`);
    }
  } catch (error) {
    await import('node:fs/promises').then((m) => m.rm(dumpPath, { force: true })).catch(() => {});
    const msg = sanitizarErro(error);
    if (msg.includes('ENOENT') || msg.includes('not found')) {
      log('Aviso: pg_dump não encontrado; backup de banco não criado.');
    } else {
      log(`Aviso: backup de banco falhou: ${msg}`);
    }
  }
  return dir;
}

export async function encontrarBackupRecente({ root, readdirFn }) {
  let entradas;
  try {
    entradas = await readdirFn(join(root, 'backups'));
  } catch (error) {
    if (error?.code === 'ENOENT') return null;
    throw error;
  }
  const dirs = entradas.filter((n) => n.includes('-')).sort().reverse();
  for (const nome of dirs) {
    const dump = join(root, 'backups', nome, 'dump.sql');
    try {
      await readFile(dump);
      return join(root, 'backups', nome);
    } catch (error) {
      if (error?.code === 'ENOENT') continue;
      throw error;
    }
  }
  return dirs.length > 0 ? join(root, 'backups', dirs[0]) : null;
}
