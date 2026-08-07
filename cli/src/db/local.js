import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import * as fsPromises from 'node:fs/promises';
import { userInfo } from 'node:os';
import { dirname, join } from 'node:path';

import { ErroCancelado } from '../ui.js';
import { gerarSenhaBanco } from './validacao.js';

export const PORTA_POSTGRES_PADRAO = 5432;

export const POSTGRESAPP = {
  url: 'https://github.com/PostgresApp/PostgresApp/releases/download/v2.9.5/Postgres-2.9.5-16.dmg',
  sha256: '3fddff8f7c94b62f428c3972d65bc930b820c1d8f15220dc51ab4e0e819f3a59',
};

export const EDB_INSTALLER = {
  url: 'https://get.enterprisedb.com/postgresql/postgresql-16.4-1-windows-x64.exe',
  sha256: 'f4bf0ac4b33471f18aad7d1d9cc52613003f3a3a612aae167366bf7f7840b2bc',
};

export function comandoAssincrono([comando, ...args], { env, cwd, input, signal } = {}) {
  return new Promise((resolve) => {
    const filho = spawn(comando, args, {
      env: { ...process.env, ...(env ?? {}), LC_ALL: 'C' },
      cwd,
      signal,
      windowsHide: true,
      stdio: input === undefined ? undefined : ['pipe', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    filho.stdout?.on('data', (d) => { stdout += d; });
    filho.stderr?.on('data', (d) => { stderr += d; });
    filho.on('error', (error) => resolve({ exitCode: -1, stdout: '', stderr: error.message }));
    filho.on('spawn', () => {
      if (input !== undefined) {
        filho.stdin.end(input);
      }
    });
    filho.on('close', (codigo) => resolve({ exitCode: codigo ?? -1, stdout, stderr }));
  });
}

function dirsCandidatos(plataforma) {
  if (plataforma === 'darwin') {
    return [
      '/opt/homebrew/opt/postgresql@16/bin',
      '/opt/homebrew/opt/postgresql@17/bin',
      '/opt/homebrew/opt/postgresql@18/bin',
      '/usr/local/opt/postgresql@16/bin',
      '/usr/local/opt/postgresql@17/bin',
      '/usr/local/opt/postgresql@18/bin',
      '/Applications/Postgres.app/Contents/Versions/16/bin',
      '/Applications/Postgres.app/Contents/Versions/17/bin',
      '/Applications/Postgres.app/Contents/Versions/18/bin',
    ];
  }
  if (plataforma === 'linux') {
    return ['/usr/lib/postgresql/16/bin', '/usr/lib/postgresql/17/bin', '/usr/lib/postgresql/18/bin', '/usr/bin'];
  }
  if (plataforma === 'win32') {
    return ['C:\\Program Files\\PostgreSQL\\16\\bin', 'C:\\Program Files\\PostgreSQL\\17\\bin', 'C:\\Program Files\\PostgreSQL\\18\\bin'];
  }
  return [];
}

async function binariosPresentes(fs, binDir) {
  for (const bin of ['initdb', 'pg_ctl']) {
    try {
      await fs.stat(join(binDir, bin));
    } catch {
      return false;
    }
  }
  return true;
}

async function lerVersaoPostgres(caminho, executar) {
  const resultado = await executar([caminho, '--version']);
  if (resultado.exitCode !== 0) return null;
  const major = Number.parseInt((String(resultado.stdout).match(/PostgreSQL\)? (\d+)/) ?? [])[1] ?? '', 10);
  return Number.isNaN(major) ? null : major;
}

export async function validarBinarioPostgres({ binDir, executar = comandoAssincrono } = {}) {
  const versao = await lerVersaoPostgres(join(binDir, 'postgres'), executar);
  if (versao === null || versao < 16 || versao > 18) {
    throw new Error('A instalação PostgreSQL local não está na matriz suportada (16, 17 ou 18).');
  }
  return versao;
}

export async function detectarPostgres({
  executar = comandoAssincrono,
  fs = fsPromises,
  plataforma = process.platform,
} = {}) {
  for (const binDir of dirsCandidatos(plataforma)) {
    if (!(await binariosPresentes(fs, binDir))) continue;
    const versao = await lerVersaoPostgres(join(binDir, 'postgres'), executar);
    if (versao === null) continue;
    if (plataforma === 'win32') return { binDir, versao, instaladoPorNos: false };
    const resultado = await executar(
      [join(binDir, 'psql'), '-c', 'SELECT 1'],
      {
        env: {
          ...process.env,
          PGHOST: '127.0.0.1',
          PGPORT: '5432',
          PGUSER: userInfo().username,
          PGDATABASE: 'postgres',
        },
      },
    );
    if (resultado.exitCode === 0) return { binDir, versao, instaladoPorNos: false };
  }
  return null;
}

export async function validarPostgresLocal({
  binDir,
  porta = PORTA_POSTGRES_PADRAO,
  executar = comandoAssincrono,
  senha,
} = {}) {
  const resultado = await executar(
    [join(binDir, 'psql'), '-h', '127.0.0.1', '-p', String(porta), '-U', 'postgres', '-d', 'postgres', '-f', '-'],
    {
      env: { ...process.env, PGPASSWORD: senha },
      input: 'SELECT 1;\n',
    },
  );
  if (resultado.exitCode !== 0) {
    throw new Error('Não foi possível conectar ao PostgreSQL local com a senha informada.');
  }
}

async function rodar(executar, args, mensagem, opcoes) {
  const resultado = await executar(args, opcoes);
  if (resultado.exitCode !== 0) throw new Error(mensagem);
  return resultado;
}

async function primeiroDirExistente(fs, dirs) {
  for (const dir of dirs) {
    try {
      await fs.stat(dir);
      return dir;
    } catch {
      // tenta o próximo
    }
  }
  return null;
}

async function hashArquivo(caminho, fs) {
  const dados = await fs.readFile(caminho);
  return createHash('sha256').update(dados).digest('hex');
}

async function verificarSha256(caminho, fs, esperado, hashFn = (arquivo) => hashArquivo(arquivo, fs)) {
  if (await hashFn(caminho) !== esperado) {
    throw new Error('A verificação SHA-256 do download PostgreSQL falhou. Abortando a instalação.');
  }
}

async function confirmarOuCancelar(confirmar, opcoes) {
  if (typeof confirmar !== 'function') return;
  if (!(await confirmar(opcoes))) throw new ErroCancelado();
}

async function instalarDarwin({ root, confirmar, baixar, executar, fs, hashFn, sinal }) {
  const dmg = join(root, 'downloads', 'postgresapp.dmg');
  const mountPoint = join(root, 'dmg');

  await fs.mkdir(dirname(dmg), { recursive: true });
  await fs.mkdir(mountPoint, { recursive: true });
  await confirmarOuCancelar(confirmar, { mensagem: 'Baixar o Postgres.app oficial (PostgreSQL 16)?' });
  await baixar(POSTGRESAPP.url, dmg, { signal: sinal });
  await verificarSha256(dmg, fs, POSTGRESAPP.sha256, hashFn);

  await confirmarOuCancelar(confirmar, { mensagem: 'Montar a imagem do Postgres.app?' });
  await rodar(
    executar,
    ['hdiutil', 'attach', '-nobrowse', '-mountpoint', mountPoint, dmg],
    'Falha ao montar a imagem do Postgres.app.',
    { signal: sinal },
  );
  let montado = true;
  try {
    await confirmarOuCancelar(confirmar, { mensagem: `Copiar o Postgres.app para ${root}?` });
    await fs.cp(join(mountPoint, 'Postgres.app'), join(root, 'Postgres.app'), { recursive: true });

    await confirmarOuCancelar(confirmar, { mensagem: 'Desmontar a imagem do Postgres.app?' });
    await rodar(executar, ['hdiutil', 'detach', mountPoint], 'Falha ao desmontar a imagem do Postgres.app.', { signal: sinal });
    montado = false;
  } finally {
    if (montado) {
      await executar(['hdiutil', 'detach', mountPoint]).catch(() => {});
    }
  }

  return {
    binDir: join(root, 'Postgres.app', 'Contents', 'Versions', '16', 'bin'),
    superuserPassword: gerarSenhaBanco(24),
  };
}

async function lerDistroInfo(fs, distroId, distroVersion) {
  if (distroId) return { id: distroId, version: distroVersion ?? '' };
  try {
    const conteudo = await fs.readFile('/etc/os-release', 'utf8');
    const id = (conteudo.match(/^ID=(.+)$/m) ?? [])[1]?.replaceAll('"', '').trim() ?? '';
    const like = (conteudo.match(/^ID_LIKE=(.+)$/m) ?? [])[1]?.replaceAll('"', '').trim() ?? '';
    const version = (conteudo.match(/^VERSION_ID=(.+)$/m) ?? [])[1]?.replaceAll('"', '').trim() ?? '';
    return { id: `${id} ${like}`, version };
  } catch {
    return { id: '', version: '' };
  }
}

export async function validarDistroLinux({ fs = fsPromises, distroId, distroVersion } = {}) {
  const distro = await lerDistroInfo(fs, distroId, distroVersion);
  const apt = (/ubuntu/.test(distro.id) && ['22.04', '24.04'].includes(distro.version))
    || (/debian/.test(distro.id) && distro.version === '12');
  if (apt) return { ...distro, familia: 'apt' };
  if (/rhel|rocky|alma/.test(distro.id) && distro.version.startsWith('9')) {
    return { ...distro, familia: 'dnf' };
  }
  throw new Error('O banco de dados local não é suportado neste sistema. Use Neon ou Supabase.');
}

async function instalarLinux({ confirmar, executar, fs, distroId, distroVersion, sinal }) {
  const distro = await validarDistroLinux({ fs, distroId, distroVersion });
  if (distro.familia === 'apt') {
    await confirmarOuCancelar(confirmar, { mensagem: 'Instalar o PostgreSQL 16 via apt (requer sudo)?' });
    await rodar(executar, ['sudo', 'apt-get', 'update'], 'Falha ao atualizar a lista de pacotes apt.', { signal: sinal });
    let politica = await executar(['apt-cache', 'policy', 'postgresql-16'], { signal: sinal });
    const temCandidato16 = (resultado) => resultado.exitCode === 0
      && /^\s*Candidate:\s*16(?:[.\d:+~-]|$)/mi.test(String(resultado.stdout ?? ''));
    if (!temCandidato16(politica)) {
      await confirmarOuCancelar(confirmar, {
        mensagem: 'A distribuição não oferece PostgreSQL 16. Configurar o repositório oficial PGDG?',
      });
      await rodar(
        executar,
        ['sudo', 'apt-get', 'install', '-y', 'postgresql-common', 'ca-certificates'],
        'Falha ao instalar os componentes do repositório PostgreSQL.',
        { signal: sinal },
      );
      await rodar(
        executar,
        ['sudo', '/usr/share/postgresql-common/pgdg/apt.postgresql.org.sh'],
        'Falha ao configurar o repositório oficial PostgreSQL para esta distribuição.',
        { signal: sinal, input: '\n' },
      );
      await rodar(executar, ['sudo', 'apt-get', 'update'], 'Falha ao atualizar o repositório PostgreSQL.', { signal: sinal });
      politica = await executar(['apt-cache', 'policy', 'postgresql-16'], { signal: sinal });
      if (!temCandidato16(politica)) {
        throw new Error(
          'O pacote PostgreSQL 16 não está disponível nos repositórios configurados. '
          + 'Escolha Neon/Supabase.',
        );
      }
    }
    await rodar(executar, ['sudo', 'apt-get', 'install', '-y', 'postgresql-16'], 'Falha ao instalar o PostgreSQL via apt.', { signal: sinal });
    const binDir = (await primeiroDirExistente(fs, [
      '/usr/lib/postgresql/16/bin',
      '/usr/lib/postgresql/17/bin',
      '/usr/lib/postgresql/18/bin',
    ])) ?? '/usr/lib/postgresql/16/bin';
    return { binDir, instaladoPorNos: false };
  }
  if (distro.familia === 'dnf') {
    await confirmarOuCancelar(confirmar, { mensagem: 'Instalar o PostgreSQL via dnf (requer sudo)?' });
    const modulo = await rodar(
      executar,
      ['sudo', 'dnf', 'module', 'info', 'postgresql:16'],
      'O stream PostgreSQL 16 não está disponível neste sistema.',
      { signal: sinal },
    );
    if (!/\b16\b/.test(String(modulo.stdout ?? ''))) {
      throw new Error('O stream PostgreSQL 16 não está disponível neste sistema. Use Neon ou Supabase.');
    }
    await rodar(
      executar,
      ['sudo', 'dnf', 'module', 'enable', '-y', 'postgresql:16'],
      'Falha ao selecionar o PostgreSQL 16 via dnf.',
      { signal: sinal },
    );
    await rodar(
      executar,
      ['sudo', 'dnf', 'install', '-y', 'postgresql-server', 'postgresql'],
      'Falha ao instalar o PostgreSQL via dnf.',
      { signal: sinal },
    );
    await rodar(
      executar,
      ['sudo', 'postgresql-setup', '--initdb', '--unit', 'postgresql'],
      'Falha ao inicializar o serviço PostgreSQL.',
      { signal: sinal },
    );
    await rodar(
      executar,
      ['sudo', 'systemctl', 'enable', '--now', 'postgresql'],
      'Falha ao iniciar o serviço PostgreSQL.',
      { signal: sinal },
    );
    const binDir = (await primeiroDirExistente(fs, ['/usr/pgsql-16/bin'])) ?? '/usr/bin';
    return { binDir, instaladoPorNos: false };
  }
  throw new Error('O banco de dados local não é suportado neste sistema. Use Neon ou Supabase.');
}

async function instalarWindows({ root, confirmar, baixar, executar, fs, hashFn, sinal }) {
  const instalador = join(root, 'downloads', 'pg-setup.exe');
  const ini = join(root, 'tmp', 'pg-installer.ini');
  const senha = gerarSenhaBanco(24);

  await fs.mkdir(dirname(instalador), { recursive: true });
  await confirmarOuCancelar(confirmar, { mensagem: 'Baixar o instalador EDB do PostgreSQL 16?' });
  await baixar(EDB_INSTALLER.url, instalador, { signal: sinal });
  await verificarSha256(instalador, fs, EDB_INSTALLER.sha256, hashFn);
  await fs.mkdir(dirname(ini), { recursive: true });
  await fs.writeFile(ini, `superpassword=${senha}\nserverport=${PORTA_POSTGRES_PADRAO}\n`, { mode: 0o600 });
  try {
    await confirmarOuCancelar(confirmar, { mensagem: 'Executar o instalador EDB em modo silencioso?' });
    await rodar(
      executar,
      [instalador, '--mode', 'unattended', '--unattendedmodeui', 'none', '--optionfile', ini],
      'Falha ao executar o instalador do PostgreSQL.',
      { signal: sinal },
    );
  } finally {
    await fs.rm(ini, { force: true });
  }
  const binDir = (await primeiroDirExistente(fs, [
    'C:\\Program Files\\PostgreSQL\\16\\bin',
    'C:\\Program Files\\PostgreSQL\\17\\bin',
    'C:\\Program Files\\PostgreSQL\\18\\bin',
  ])) ?? 'C:\\Program Files\\PostgreSQL\\16\\bin';
  return { binDir, superuserPassword: senha };
}

export async function instalarPostgres({
  plataforma = process.platform,
  arquitetura = process.arch,
  root,
  confirmar,
  baixar,
  executar = comandoAssincrono,
  fs = fsPromises,
  hashFn,
  distroId,
  distroVersion,
  sinal,
} = {}) {
  if (plataforma === 'darwin' && (arquitetura === 'arm64' || arquitetura === 'x64')) {
    return instalarDarwin({ root, confirmar, baixar, executar, fs, hashFn, sinal });
  }
  if (plataforma === 'linux') {
    return instalarLinux({ confirmar, executar, fs, distroId, distroVersion, sinal });
  }
  if (plataforma === 'win32' && arquitetura === 'x64') {
    return instalarWindows({ root, confirmar, baixar, executar, fs, hashFn, sinal });
  }
  throw new Error('O banco de dados local não é suportado neste sistema. Use Neon ou Supabase.');
}

async function iniciarCluster({ binDir, root, porta, executar, fs, superuserPassword, sinal }) {
  const pgdata = join(root, 'pgdata');
  try {
    await fs.stat(pgdata);
  } catch {
    const senhaPath = join(root, 'tmp', 'postgres-superuser.password');
    await fs.mkdir(dirname(senhaPath), { recursive: true });
    await fs.writeFile(senhaPath, `${superuserPassword}\n`, { mode: 0o600 });
    try {
      const auth = ['--auth-local=trust', '--auth-host=scram-sha-256', '--pwfile', senhaPath];
      await rodar(
        executar,
        [join(binDir, 'initdb'), '-D', pgdata, '-U', 'postgres', ...auth, '-E', 'UTF8'],
        'Falha ao inicializar o cluster PostgreSQL.',
        { signal: sinal },
      );
    } finally {
      await fs.rm(senhaPath, { force: true });
    }
  }

  const logPath = join(root, 'logs', 'postgres.log');
  await fs.mkdir(dirname(logPath), { recursive: true });
  await rodar(
    executar,
    [join(binDir, 'pg_ctl'), '-D', pgdata, '-o', `-p ${porta} -h 127.0.0.1`, '-l', logPath, 'start'],
    'Falha ao iniciar o PostgreSQL.',
    { signal: sinal },
  );

  if (!(await aguardarPronto(binDir, porta, executar, sinal))) {
    throw new Error('O PostgreSQL não ficou pronto em 10 segundos.');
  }
}

async function aguardarPronto(binDir, porta, executar, sinal) {
  const limite = Date.now() + 10_000;
  while (Date.now() < limite) {
    if (sinal?.aborted) return false;
    const resultado = await executar(
      [join(binDir, 'pg_isready'), '-h', '127.0.0.1', '-p', String(porta)],
      { signal: sinal },
    );
    if (resultado.exitCode === 0) return true;
    await new Promise((resolve) => {
      const timer = setTimeout(resolve, 500);
      sinal?.addEventListener('abort', () => {
        clearTimeout(timer);
        resolve();
      }, { once: true });
    });
  }
  return false;
}

function montarSuperuser({ binDir, porta, plataforma, instaladoPorNos, superuserPassword }) {
  const base = [join(binDir, 'psql'), '-h', '127.0.0.1', '-p', String(porta)];
  if (!instaladoPorNos && plataforma === 'linux') {
    return { args: ['sudo', '-u', 'postgres', join(binDir, 'psql'), '-d', 'postgres', '-f', '-'], env: null };
  }
  const usuario = instaladoPorNos || plataforma === 'win32' ? 'postgres' : userInfo().username;
  return {
    args: [...base, '-U', usuario, '-d', 'postgres', '-f', '-'],
    env: superuserPassword ? { ...process.env, PGPASSWORD: superuserPassword } : null,
  };
}

function executarPsql(executar, superuser, sql, sinal) {
  return executar([...superuser.args], {
    ...(superuser.env ? { env: superuser.env } : {}),
    input: sql,
    ...(sinal ? { signal: sinal } : {}),
  });
}

async function criarRole(executar, superuser, senha, sinal) {
  const resultado = await executarPsql(executar, superuser, `CREATE ROLE geronticare_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS PASSWORD '${senha}';`, sinal);
  if (resultado.exitCode === 0) return;
  if (!String(resultado.stderr ?? '').includes('already exists')) {
    throw new Error('Falha ao criar a role geronticare_app.');
  }
  const alterado = await executarPsql(executar, superuser, `ALTER ROLE geronticare_app WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS PASSWORD '${senha}';`, sinal);
  if (alterado.exitCode !== 0) {
    throw new Error('Falha ao atualizar a role geronticare_app.');
  }
}

async function criarBanco(executar, superuser, sinal) {
  const resultado = await executarPsql(executar, superuser, 'CREATE DATABASE geronticare OWNER geronticare_app', sinal);
  if (resultado.exitCode !== 0 && !String(resultado.stderr ?? '').includes('already exists')) {
    throw new Error('Falha ao criar o banco geronticare.');
  }
}

export async function criarBancoDedicado({
  binDir,
  root,
  porta = 5432,
  instaladoPorNos = false,
  superuserPassword,
  confirmar,
  executar = comandoAssincrono,
  fs = fsPromises,
  plataforma = process.platform,
  sinal,
} = {}) {
  if (instaladoPorNos) {
    await confirmarOuCancelar(confirmar, { mensagem: 'Inicializar e iniciar o cluster PostgreSQL dedicado do GerontiCare?' });
    if (plataforma !== 'win32') {
      await iniciarCluster({ binDir, root, porta, executar, fs, superuserPassword, sinal });
    }
  }

  const senha = gerarSenhaBanco(24);
  const superuser = montarSuperuser({ binDir, porta, plataforma, instaladoPorNos, superuserPassword });
  await criarRole(executar, superuser, senha, sinal);
  await criarBanco(executar, superuser, sinal);

  return {
    databaseUrl: `postgresql://geronticare_app:${senha}@127.0.0.1:${porta}/geronticare`,
    senha,
    binDir,
  };
}
