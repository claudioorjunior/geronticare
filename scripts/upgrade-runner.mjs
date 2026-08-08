import { createHash, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { copyFile, mkdir, open, readFile, readdir, rename, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';

const root = process.argv[2];
const target = process.argv[3];
if (!root || !target) {
  console.error('Uso: upgrade-runner.mjs <root> <versao>');
  process.exit(2);
}

function sanitizar(erro) {
  const m = erro instanceof Error ? erro.message : String(erro ?? '');
  return m.replace(/[a-z][a-z0-9+.-]*:\/\/[^\s"'<>]+/gi, (uri) => {
    try {
      const u = new URL(uri);
      if (u.password) u.password = '***';
      if (u.username) u.username = '***';
      return u.toString();
    } catch { return uri.replace(/:\/\/[^@\s]+@/, '://***:***@'); }
  });
}

async function lerJson(rootDir, name) {
  try {
    const raw = await readFile(join(rootDir, name), 'utf8');
    const v = JSON.parse(raw);
    return v && typeof v === 'object' && !Array.isArray(v) ? v : null;
  } catch (e) {
    if (e?.code === 'ENOENT') return null;
    if (e instanceof SyntaxError) return null;
    throw e;
  }
}

async function escreverAtomico(rootDir, name, data) {
  await mkdir(rootDir, { recursive: true, mode: 0o700 });
  const dest = join(rootDir, name);
  const tmp = `${dest}.${process.pid}.${randomUUID()}.tmp`;
  const f = await open(tmp, 'wx', 0o600);
  try { await f.writeFile(`${JSON.stringify(data, null, 2)}\n`); await f.sync(); } finally { await f.close(); }
  try { await rename(tmp, dest); } catch (e) {
    if (e?.code !== 'EPERM' && e?.code !== 'EEXIST') throw e;
    await rm(dest, { force: true });
    await rename(tmp, dest);
  }
}

async function escreverStatus(patch) {
  const cur = (await lerJson(root, 'update-status.json')) ?? {};
  await escreverAtomico(root, 'update-status.json', { ...cur, ...patch, updatedAt: new Date().toISOString() });
}

function versaoSegura(v) { return typeof v === 'string' && /^\d+\.\d+\.\d+$/.test(v); }

async function backupAntesDeMigrar(config, segredos) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dir = join(root, 'backups', `${stamp}-${config.versao}`);
  await mkdir(dir, { recursive: true, mode: 0o700 });
  try { await copyFile(join(root, 'config.json'), join(dir, 'config.json')); } catch {}
  try { await copyFile(join(root, 'secrets.json'), join(dir, 'secrets.json')); } catch {}
  const dumpPath = join(dir, 'dump.sql');
  try {
    const r = await executar(['pg_dump', '--no-owner', '--format=plain', '-f', dumpPath], { env: { DATABASE_URL: segredos.DATABASE_URL } });
    if (r.exitCode !== 0) { await rm(dumpPath, { force: true }).catch(() => {}); console.log(`Aviso pg_dump ${r.exitCode}`); }
  } catch (e) {
    await rm(dumpPath, { force: true }).catch(() => {});
    console.log(`Aviso backup: ${sanitizar(e)}`);
  }
}

function executar(args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(args[0], args.slice(1), { ...opts, env: { ...process.env, LC_ALL: 'C', ...(opts.env ?? {}) }, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    let stdout = '', stderr = '';
    child.stdout?.on('data', (c) => { stdout += c; });
    child.stderr?.on('data', (c) => { stderr += c; });
    child.once('error', reject);
    child.once('close', (code) => resolve({ exitCode: code ?? 1, stdout, stderr }));
  });
}

function ultimaLinha(r) {
  const saida = String(r.stderr ?? r.stdout ?? '').trim().split('\n').filter(Boolean);
  const linha = saida.at(-1) ?? 'saída vazia';
  return linha.length > 300 ? `${linha.slice(0, 300)}…` : linha;
}

async function hashSha256(caminho) {
  const h = createHash('sha256');
  const f = await open(caminho, 'r');
  const buf = Buffer.allocUnsafe(1024 * 1024);
  try { for (;;) { const { bytesRead } = await f.read(buf, 0, buf.length, null); if (bytesRead === 0) break; h.update(bytesRead === buf.length ? buf : buf.subarray(0, bytesRead)); } } finally { await f.close(); }
  return h.digest('hex');
}

function parsearSha256(c) { const t = String(c).trim().split(/\s+/)[0]; if (!t) throw new Error('.sha256 vazio'); return t.toLowerCase(); }

async function baixarArquivo({ url, destino }) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Falha ao baixar ${url} (HTTP ${r.status})`);
  const f = await open(destino, 'w', 0o600);
  try { for await (const chunk of r.body) await f.write(chunk); } finally { await f.close(); }
}

async function comandoNpm({ args, cwd, env }) {
  const cmd = process.platform === 'win32' ? [process.execPath, join(dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js'), ...args] : ['npm', ...args];
  const r = await executar(cmd, { cwd, env });
  if (r.exitCode !== 0) throw new Error(`Falha ao executar "npm ${args[0] === 'run' ? args[1] : args[0]}": ${ultimaLinha(r)}`);
  return r;
}

async function prepararRelease({ versao, porta }) {
  const releasesDir = join(root, 'releases');
  const releaseDir = join(releasesDir, versao);
  const cacheDir = join(root, 'downloads', 'releases', versao);
  const urlApp = `http://127.0.0.1:${porta}`;
  const nomeTar = `geronticare-app-v${versao}.tar.gz`;
  const nomeSha = `geronticare-app-v${versao}.sha256`;
  const baseUrl = `https://github.com/claudioorjunior/geronticare/releases/download/v${versao}`;

  const marker = await lerJson(releaseDir, 'verified.json');
  if (marker?.sha256 && marker?.arquivo === nomeTar) {
    try { const h = await hashSha256(join(releaseDir, nomeTar)); if (h === marker.sha256) return { releaseDir, baixado: false }; } catch {}
  }
  if (await lerJson(releaseDir, 'verified.json')) throw new Error(`Release v${versao} existente não pode ser substituída. Rode o doctor.`);

  const staging = join(root, 'staging', randomUUID());
  try {
    await mkdir(staging, { recursive: true, mode: 0o700 });
    const tarStaging = join(staging, nomeTar);
    const shaStaging = join(staging, nomeSha);
    const cacheTar = join(cacheDir, nomeTar);
    const cacheSha = join(cacheDir, nomeSha);
    let cacheOk = false;
    try {
      const m = await lerJson(cacheDir, 'verified.json');
      if (m?.arquivo === nomeTar && m?.sha256) {
        await readFile(cacheTar); await readFile(cacheSha);
        if (await hashSha256(cacheTar) === m.sha256) cacheOk = true;
      }
    } catch { cacheOk = false; }

    if (!cacheOk) {
      await baixarArquivo({ url: `${baseUrl}/${nomeTar}`, destino: tarStaging });
      await baixarArquivo({ url: `${baseUrl}/${nomeSha}`, destino: shaStaging });
      const shaEsperado = parsearSha256(await readFile(shaStaging, 'utf8'));
      const sha256 = await hashSha256(tarStaging);
      if (sha256 !== shaEsperado) throw new Error('Checksum não confere com .sha256.');
      await mkdir(cacheDir, { recursive: true, mode: 0o700 });
      await copyFile(tarStaging, cacheTar);
      await copyFile(shaStaging, cacheSha);
      await escreverAtomico(cacheDir, 'verified.json', { versao, arquivo: nomeTar, sha256 });
    }

    const destinoApp = join(staging, 'app');
    await mkdir(destinoApp, { mode: 0o700 });
    const tarFonte = cacheOk ? cacheTar : tarStaging;
    const linhas = (s) => String(s ?? '').split('\n').filter((l) => l.trim() !== '');
    const nomes = linhas((await executar(['tar', '-tzf', tarFonte])).stdout);
    const tipos = linhas((await executar(['tar', '-tvf', tarFonte])).stdout).map((l) => l.split(/\s+/)[0]?.[0] ?? '');
    for (const n of nomes) {
      if (n === '' || n.includes('\0')) throw new Error(`Arquivo inseguro: "${n}"`);
      const norm = n.replaceAll('\\', '/');
      if (norm.startsWith('/') || (process.platform === 'win32' && /^[A-Za-z]:\//.test(norm))) throw new Error(`Arquivo inseguro caminho absoluto "${n}"`);
      if (norm.split('/').includes('..')) throw new Error(`Arquivo inseguro subida "${n}"`);
    }
    for (const t of tipos) if (t !== '-' && t !== 'd') throw new Error('Links ou entradas inseguras no tar.');
    await executar(['tar', '-xzf', tarFonte, '-C', destinoApp, '--no-same-owner', '--no-same-permissions']);
    const envBuild = { ...process.env, NEXT_PUBLIC_APP_URL: urlApp };
    await comandoNpm({ args: ['ci'], cwd: destinoApp, env: envBuild });
    await comandoNpm({ args: ['run', 'build', '--', '--webpack'], cwd: destinoApp, env: envBuild });
    await mkdir(releasesDir, { recursive: true, mode: 0o700 });
    try { await readFile(join(releaseDir, 'verified.json')); throw new Error(`Release v${versao} criada por outro processo.`); } catch (e) { if (e?.code !== 'ENOENT') throw e; }
    const releaseStaging = join(staging, 'release');
    await rename(destinoApp, releaseStaging);
    await copyFile(cacheOk ? cacheTar : tarStaging, join(releaseStaging, nomeTar));
    // ensure sha file exists in staging
    const shaSrc = cacheOk ? cacheSha : shaStaging;
    try { await copyFile(shaSrc, join(releaseStaging, nomeSha)); } catch {}
    const sha256 = await hashSha256(cacheOk ? cacheTar : tarStaging);
    await escreverAtomico(releaseStaging, 'verified.json', { versao, arquivo: nomeTar, sha256, nextPublicAppUrl: urlApp });
    await rename(releaseStaging, releaseDir);
    await rm(staging, { recursive: true, force: true });
    return { releaseDir, baixado: !cacheOk };
  } catch (e) {
    await rm(staging, { recursive: true, force: true }).catch(() => {});
    throw new Error(sanitizar(e));
  }
}

async function lerPid() {
  try { const c = await readFile(join(root, 'server.pid'), 'utf8'); const p = Number.parseInt(c.trim(), 10); return Number.isInteger(p) ? p : null; } catch (e) { if (e?.code === 'ENOENT') return null; throw e; }
}
async function escreverPid(pid) {
  await mkdir(root, { recursive: true, mode: 0o700 });
  const dest = join(root, 'server.pid');
  const tmp = `${dest}.${process.pid}.${randomUUID()}.tmp`;
  const f = await open(tmp, 'wx', 0o600);
  try { await f.writeFile(`${pid}\n`); await f.sync(); } finally { await f.close(); }
  try { await rename(tmp, dest); } catch (e) {
    if (e?.code !== 'EPERM' && e?.code !== 'EEXIST') throw e;
    await rm(dest, { force: true }); await rename(tmp, dest);
  }
}
async function removerPid() { await rm(join(root, 'server.pid'), { force: true }); }
async function pararServidorDetached() {
  const pid = await lerPid(); if (pid === null) return { parado: false };
  try { process.kill(pid, 0); } catch (e) { if (e?.code === 'ESRCH') { await removerPid(); return { parado: false }; } throw e; }
  try { process.kill(pid, 'SIGTERM'); } catch {}
  const inicio = Date.now();
  while (Date.now() - inicio < 5000) { try { process.kill(pid, 0); } catch (e) { if (e?.code === 'ESRCH') break; throw e; } await new Promise((r) => setTimeout(r, 200)); }
  try { process.kill(pid, 0); try { process.kill(pid, 'SIGKILL'); } catch {} } catch (e) { if (e?.code !== 'ESRCH') throw e; }
  await removerPid(); return { parado: true, pid };
}
async function iniciarServidorDetached({ releaseDir, config, segredos }) {
  const pidAtual = await lerPid();
  if (pidAtual !== null) { try { process.kill(pidAtual, 0); throw new Error(`Servidor já rodando (PID ${pidAtual})`); } catch (e) { if (e?.message?.includes('já rodando')) throw e; if (e?.code !== 'ESRCH') throw e; await removerPid(); } }
  const logsDir = join(root, 'logs'); await mkdir(logsDir, { recursive: true, mode: 0o700 });
  const logPath = join(logsDir, 'server.log');
  const logFd = await open(logPath, 'a', 0o600);
  const fd = logFd.fd;
  const bin = join(releaseDir, 'node_modules', 'next', 'dist', 'bin', 'next');
  const authUrl = `http://127.0.0.1:${config.porta}`;
  const env = {
    DATABASE_URL: segredos.DATABASE_URL, AUTH_SECRET: segredos.AUTH_SECRET, AUTH_URL: authUrl, NEXT_PUBLIC_APP_URL: authUrl,
    PORT: String(config.porta), NODE_ENV: 'production', PATH: process.env.PATH, HOME: process.env.HOME,
  };
  if (process.env.GERONTICARE_HOME) env.GERONTICARE_HOME = process.env.GERONTICARE_HOME;
  for (const k of ['SystemRoot', 'TEMP', 'TMP', 'USERPROFILE', 'COMSPEC']) if (process.env[k]) env[k] = process.env[k];
  if (segredos.SETUP_TOKEN) env.SETUP_TOKEN = segredos.SETUP_TOKEN;
  if (segredos.SETUP_TOKEN_EXPIRES_AT) env.SETUP_TOKEN_EXPIRES_AT = segredos.SETUP_TOKEN_EXPIRES_AT;
  const child = spawn(process.execPath, [bin, 'start', '-H', '127.0.0.1', '-p', String(config.porta)], { cwd: releaseDir, env, detached: true, stdio: ['ignore', fd, fd], windowsHide: true });
  child.unref();
  await escreverPid(child.pid);
  return { pid: child.pid, logPath };
}
async function aguardarProntidao(porta, limiteMs = 120_000) {
  const inicio = Date.now();
  let healthOk = false;
  while (Date.now() - inicio < limiteMs) {
    try {
      const h = await fetch(`http://127.0.0.1:${porta}/api/health`);
      if (h.ok) {
        if (!healthOk) healthOk = true;
        const s = await fetch(`http://127.0.0.1:${porta}/api/setup`);
        if (s.ok) { await s.json().catch(() => null); return; }
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`Servidor não ficou pronto em ${limiteMs / 1000}s.`);
}

async function adquirirLock(rootDir) {
  const lockPath = join(rootDir, 'install.lock');
  const { open } = await import('node:fs/promises');
  try {
    const f = await open(lockPath, 'wx', 0o600);
    await f.writeFile(`${process.pid}\n`);
    await f.sync();
    return f;
  } catch (e) {
    if (e?.code !== 'EEXIST') throw e;
  }
  try {
    const pidExistente = Number.parseInt(await readFile(lockPath, 'utf8'), 10);
    if (Number.isInteger(pidExistente)) {
      try { process.kill(pidExistente, 0); throw new Error('Outra operação em andamento (lock ativo).'); } catch (err) { if (err?.message?.includes('Outra operação')) throw err; if (err?.code !== 'ESRCH') throw err; }
    }
  } catch (err) { if (err?.message?.includes('Outra operação')) throw err; }
  const { rm } = await import('node:fs/promises');
  await rm(lockPath, { force: true }).catch(() => {});
  const f = await open(lockPath, 'wx', 0o600);
  await f.writeFile(`${process.pid}\n`);
  await f.sync();
  return f;
}

async function main() {
  const lock = await adquirirLock(root);
  try {
  const estado = await lerJson(root, 'install-state.json');
  const config = await lerJson(root, 'config.json');
  const segredos = await lerJson(root, 'secrets.json');
  if (!estado || estado.fase !== 'READY') throw new Error('Instalação não está em READY.');
  if (!config || !segredos?.DATABASE_URL) throw new Error('config/secrets ausentes.');
  if (!versaoSegura(target)) throw new Error(`Versão inválida: ${target}`);
  if (target === config.versao) throw new Error(`Já está na v${target}.`);

  await escreverStatus({ state: 'running', phase: 'downloading', target, startedAt: new Date().toISOString(), error: null });

  await backupAntesDeMigrar(config, segredos).catch(() => {});
  await escreverStatus({ phase: 'preparing' });
  await prepararRelease({ versao: target, porta: config.porta });
  await escreverStatus({ phase: 'migrating' });
  const releaseDir = join(root, 'releases', target);
  const r = await executar([process.execPath, join(releaseDir, 'scripts', 'migrate.mjs')], { cwd: releaseDir, env: { ...process.env, DATABASE_URL: segredos.DATABASE_URL } });
  if (r.exitCode !== 0) throw new Error('Falha ao aplicar migrations.');
  await escreverStatus({ phase: 'switching' });
  // ponytail: cutover de 2-3s; old serve até aqui. Migrations são expand-only; breaking schema pode falhar no old durante a janela.
  const versaoAnterior = config.versao;
  const configAnterior = { ...config };
  try {
    await pararServidorDetached().catch(() => {});
    const segredosAtuais = (await lerJson(root, 'secrets.json')) ?? segredos;
    await iniciarServidorDetached({ releaseDir, config: { ...config, versao: target }, segredos: segredosAtuais });
    await aguardarProntidao(config.porta);
  } catch (e) {
    try {
      await pararServidorDetached().catch(() => {});
      const segredosAtuais = (await lerJson(root, 'secrets.json')) ?? segredos;
      await iniciarServidorDetached({ releaseDir: join(root, 'releases', versaoAnterior), config: configAnterior, segredos: segredosAtuais }).catch(() => {});
    } catch {}
    throw e;
  }
  await escreverAtomico(root, 'config.json', { ...config, versao: target, ativo: true });
  await escreverAtomico(root, 'install-state.json', { fase: 'READY', porta: config.porta, provedor: estado.provedor, versao: target, versaoAnterior });
  const lista = await readdir(join(root, 'releases')).catch(() => []);
  const versoes = lista.filter((v) => /^\d+\.\d+\.\d+$/.test(v)).sort((a, b) => {
    const pa = a.split('.').map(Number), pb = b.split('.').map(Number);
    for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return pb[i] - pa[i];
    return 0;
  });
  for (const v of versoes.slice(2)) { await rm(join(root, 'releases', v), { recursive: true, force: true }); await rm(join(root, 'downloads', 'releases', v), { recursive: true, force: true }); }
  await escreverStatus({ state: 'done', phase: 'done', finishedAt: new Date().toISOString() });
  } finally { try { await lock.close(); } catch {} try { const { rm } = await import('node:fs/promises'); await rm(join(root, 'install.lock'), { force: true }); } catch {} }
}

try {
  await main();
  process.exit(0);
} catch (e) {
  const msg = sanitizar(e);
  try { await escreverStatus({ state: 'error', phase: 'error', error: msg, finishedAt: new Date().toISOString() }); } catch {}
  console.error(msg);
  process.exit(1);
}
