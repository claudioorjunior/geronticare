import {
  criarClientePostgres,
  provarComCliente,
  validarHostSufixo,
  validarUriPostgres,
} from './validacao.js';
import { lookup } from 'node:dns/promises';

const URL_PROJETOS = 'https://api.supabase.com/v1/projects';

async function consultar(fetchFn, url, cabecalhos) {
  let resposta;
  try {
    resposta = await fetchFn(url, { headers: cabecalhos });
  } catch {
    throw new Error('Não foi possível acessar a API do Supabase. Verifique sua conexão.');
  }
  if (!resposta.ok) {
    if (resposta.status === 401 || resposta.status === 403) {
      throw new Error('Token de acesso Supabase inválido.');
    }
    throw new Error('Falha ao consultar a API do Supabase.');
  }
  return resposta.json();
}

function encontrarPooler(corpo) {
  const lista = Array.isArray(corpo)
    ? corpo
    : (Array.isArray(corpo.pooler) ? corpo.pooler : (corpo.pooler ? [corpo.pooler] : []));
  const candidatos = lista.filter((p) => p && (
    (p.database_type === 'PRIMARY' && p.pool_mode === 'session')
    || p.connection_type === 'session'
    || p.mode === 'PRIMARY'
  ));
  const pooler = candidatos.find((p) => p.connection_type === 'session') ?? candidatos.find((p) => p.mode === 'PRIMARY') ?? null;
  if (!pooler) return null;
  const padrao = corpo.default ?? {};
  const user = padrao.user ?? pooler.user ?? pooler.db_user;
  const database = padrao.database ?? pooler.database ?? pooler.db_name;
  if (!user || !database) return null;
  return {
    pooler: {
      ...pooler,
      host: pooler.host ?? pooler.db_host,
      port: pooler.port ?? pooler.db_port,
    },
    padrao: { user, database },
  };
}

async function validarHostDireto(host, lookupFn) {
  if (!/^db\.[a-z0-9-]+\.supabase\.co$/i.test(host)) return false;
  const enderecos = await lookupFn(host, { all: true, family: 6 });
  return enderecos.some((endereco) => endereco.family === 6);
}

export async function configurarSupabase({
  pedirPat,
  pedirSenha,
  pedirUri,
  selecionar,
  fetchFn = fetch,
  criarCliente = criarClientePostgres,
  log = () => {},
  lookupFn = lookup,
} = {}) {
  const pat = String((await pedirPat()) ?? '').trim();
  if (pat.length < 20) throw new Error('Token de acesso Supabase (PAT) inválido.');
  const cabecalhos = { Authorization: `Bearer ${pat}`, Accept: 'application/json' };

  const projetos = await consultar(fetchFn, URL_PROJETOS, cabecalhos);
  const projeto = await selecionar({
    mensagem: 'Escolha o projeto Supabase:',
    opcoes: projetos.map((p) => ({
      value: p.id,
      label: p.region ? `${p.name} (${p.region})` : p.name,
    })),
  });

  let pooler = null;
  let padrao = null;
  try {
    const corpo = await consultar(fetchFn, `${URL_PROJETOS}/${projeto}/config/database/pooler`, cabecalhos);
    const encontrado = encontrarPooler(corpo);
    pooler = encontrado?.pooler ?? null;
    padrao = encontrado?.padrao ?? null;
  } catch {
    pooler = null;
  }

  if (
    pooler
    && padrao
    && String(pooler.port) === '5432'
    && validarHostSufixo(pooler.host, ['.pooler.supabase.com'])
  ) {
    const senha = String((await pedirSenha()) ?? '');
    const databaseUrl = [
      'postgresql://',
      encodeURIComponent(padrao.user),
      ':',
      encodeURIComponent(senha),
      '@',
      pooler.host,
      ':5432/',
      encodeURIComponent(padrao.database),
      '?sslmode=require',
    ].join('');
    validarUriPostgres(databaseUrl, { exigirSenha: true });
    await provarComCliente(criarCliente, databaseUrl);
    log('Conexão Supabase validada (Session pooler, SELECT 1 + objeto temporário).');
    return { databaseUrl };
  }

  const uri = String((await pedirUri()) ?? '').trim();
  validarUriPostgres(uri, { exigirSenha: true });
  const host = new URL(uri).hostname;
  const poolerValido = validarHostSufixo(host, ['.pooler.supabase.com']);
  let diretoValido = false;
  if (!poolerValido) {
    try {
      diretoValido = await validarHostDireto(host, lookupFn);
    } catch {
      diretoValido = false;
    }
  }
  if (!poolerValido && !diretoValido) {
    throw new Error('A conexão deve usar o Session pooler do Supabase (*.pooler.supabase.com).');
  }
  await provarComCliente(criarCliente, uri);
  log('Conexão Supabase validada (Session pooler, SELECT 1 + objeto temporário).');
  return { databaseUrl: uri };
}
