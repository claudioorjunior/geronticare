import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { join } from 'node:path';

import { redigirUri, sanitizarErro } from './secrets.js';

function atraso(ms, sinal) {
  return new Promise((resolver) => {
    const timer = setTimeout(resolver, ms);
    sinal?.addEventListener('abort', () => {
      clearTimeout(timer);
      resolver();
    }, { once: true });
  });
}

function redigirMensagem(mensagem) {
  return mensagem.replace(/[a-z][a-z0-9+.-]*:\/\/[^\s"'<>]+/gi, (uri) => redigirUri(uri));
}

export function montarAmbiente({ segredos, config }) {
  const authUrl = `http://127.0.0.1:${config.porta}`;
  const ambiente = {
    DATABASE_URL: segredos.DATABASE_URL,
    AUTH_SECRET: segredos.AUTH_SECRET,
    AUTH_URL: authUrl,
    NEXT_PUBLIC_APP_URL: authUrl,
    PORT: String(config.porta),
    NODE_ENV: 'production',
    PATH: process.env.PATH,
    HOME: process.env.HOME,
  };
  for (const chave of ['SystemRoot', 'TEMP', 'TMP', 'USERPROFILE', 'COMSPEC']) {
    if (process.env[chave]) ambiente[chave] = process.env[chave];
  }
  if (segredos.SETUP_TOKEN) ambiente.SETUP_TOKEN = segredos.SETUP_TOKEN;
  if (segredos.SETUP_TOKEN_EXPIRES_AT) {
    ambiente.SETUP_TOKEN_EXPIRES_AT = segredos.SETUP_TOKEN_EXPIRES_AT;
  }
  return ambiente;
}

export async function iniciarServidor({
  releaseDir,
  config,
  segredos,
  spawnFn = spawn,
  log = console.log,
}) {
  const binarioNext = join(releaseDir, 'node_modules', 'next', 'dist', 'bin', 'next');
  const filho = spawnFn(
    process.execPath,
    [binarioNext, 'start', '-H', '127.0.0.1', '-p', String(config.porta)],
    {
      cwd: releaseDir,
      env: montarAmbiente({ segredos, config }),
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    },
  );

  // Nunca imprimir URIs com credenciais nos logs do servidor.
  filho.stdout?.on('data', (pedaco) => log(redigirMensagem(String(pedaco))));
  filho.stderr?.on('data', (pedaco) => log(redigirMensagem(String(pedaco))));

  const saida = new Promise((resolver) => {
    filho.once('exit', (codigo) => resolver(codigo ?? 0));
  });

  await new Promise((resolver, rejeitar) => {
    filho.once('spawn', resolver);
    filho.once('error', (erro) => {
      rejeitar(new Error(`Falha ao iniciar o servidor: ${sanitizarErro(erro)}`));
    });
  });

  return { filho, saida };
}

export async function aguardarProntidao({
  porta,
  limiteMs = 120_000,
  fetchFn = fetch,
  intervaloMs = 1_000,
  log = console.log,
  sinal,
}) {
  const inicio = Date.now();
  let healthOk = false;

  while (Date.now() - inicio < limiteMs) {
    if (sinal?.aborted) throw new Error('Aguardamento da prontidão interrompido.');
    try {
      const opcoes = sinal ? { signal: sinal } : undefined;
      const health = await fetchFn(`http://127.0.0.1:${porta}/api/health`, opcoes);
      if (health.ok) {
        if (!healthOk) {
          healthOk = true;
          log('[prontidao] /api/health respondeu.');
        }
        const setup = await fetchFn(`http://127.0.0.1:${porta}/api/setup`, opcoes);
        if (setup.ok) {
          const estado = await setup.json();
          log('[prontidao] /api/setup respondeu.');
          return { health: true, setup: true, estado };
        }
      }
    } catch {
      // servidor ainda não está aceitando conexões; tenta de novo.
    }
    await atraso(intervaloMs, sinal);
  }

  throw new Error(
    `O servidor não ficou pronto em ${limiteMs / 1000}s.`
    + ' Veja os logs da instalação e rode o doctor para diagnosticar.',
  );
}

function servidorHttpPadrao(handler) {
  return createServer(handler);
}

export async function iniciarHandoff({
  porta,
  token,
  criarServidorHttp = servidorHttpPadrao,
  log = console.log,
}) {
  const servidor = criarServidorHttp((requisicao, resposta) => {
    if (requisicao.url !== '/') {
      resposta.statusCode = 404;
      resposta.end();
      return;
    }
    // Destino fixo; nunca derivado do cabeçalho Host.
    resposta.statusCode = 302;
    resposta.setHeader('Location', `http://127.0.0.1:${porta}/setup`);
    resposta.setHeader(
      'Set-Cookie',
      `geronticare.setup_token=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=300`,
    );
    resposta.end();
  });

  await new Promise((resolver, rejeitar) => {
    servidor.once?.('error', rejeitar);
    servidor.listen(0, '127.0.0.1', resolver);
  });

  const { port: portaReal } = servidor.address();
  const url = `http://127.0.0.1:${portaReal}/`;
  log(`[handoff] abra ${url} para concluir a configuração.`);
  return {
    url,
    fechar: () => new Promise((resolver) => servidor.close(() => resolver())),
  };
}

export async function monitorarBootstrap({
  porta,
  token,
  limiteMs = 600_000,
  intervaloMs = 2_000,
  fetchFn = fetch,
  log = console.log,
  sinal,
}) {
  const inicio = Date.now();

  while (Date.now() - inicio < limiteMs) {
    if (sinal?.aborted) {
      throw new Error('Monitoramento do bootstrap interrompido.');
    }
    let resposta;
    try {
      resposta = await fetchFn(`http://127.0.0.1:${porta}/api/setup`, {
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {
      await atraso(intervaloMs, sinal);
      continue;
    }

    if (resposta.status === 401 || resposta.status === 403) {
      throw new Error(
        'Token de configuração inválido ou expirado. Execute o instalador novamente'
        + ' para gerar um novo token.',
      );
    }

    if (resposta.ok) {
      const estado = await resposta.json();
      // 409 (POST perdido) cai em "não ok" e continua polando; sucesso só vale
      // após um GET fresco mostrar necessario:false.
      if (estado.necessario === false) {
        if (estado.inconsistente === true) {
          throw new Error(
            'A instalação está em estado inconsistente: o bootstrap foi concluído, mas há'
            + ' inconsistências pendentes. A recuperação manual é necessária; o instalador'
            + ' não remove o marcador automaticamente.',
          );
        }
        log('[bootstrap] configuração concluída.');
        return { necessario: false };
      }
    }
    await atraso(intervaloMs, sinal);
  }

  throw new Error(
    `O bootstrap não foi concluído em ${limiteMs / 1000}s.`
    + ' Reabra o navegador com `npx geronticare@latest start`; o token é preservado.',
  );
}

export async function encerrarFilho({ filho, saida, esperarMs = 5_000 } = {}) {
  if (typeof filho.kill === 'function') filho.kill('SIGTERM');
  const vencedor = await Promise.race([
    saida.then((codigo) => ({ codigo })),
    atraso(esperarMs).then(() => ({ timeout: true })),
  ]);
  if (vencedor.timeout) {
    if (typeof filho.kill === 'function') filho.kill('SIGKILL');
    return saida;
  }
  return vencedor.codigo;
}
