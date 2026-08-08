import { dirname, join } from 'node:path';

import { sanitizarErro } from '../secrets.js';
import { comandoAssincrono } from './local.js';
import {
  criarClientePostgres,
  provarComCliente,
  validarHostSufixo,
  validarUriPostgres,
} from './validacao.js';

const PACOTE_NEON = 'neon@^2.45.0';

export function comandoNpx() {
  if (process.platform === 'win32') {
    return [process.execPath, join(dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npx-cli.js')];
  }
  return ['npx'];
}

async function verificarComando(promise, mensagem) {
  let resultado;
  try {
    resultado = await promise;
  } catch (error) {
    throw new Error(`${mensagem} ${sanitizarErro(error)}`.trim());
  }
  if (resultado.exitCode !== 0) throw new Error(mensagem);
  return resultado;
}

async function listarJson(executar, args, rotulo) {
  const resultado = await verificarComando(executar(args), `Falha ao executar a CLI Neon ao listar ${rotulo}.`);
  try {
    const bruto = JSON.parse(String(resultado.stdout ?? '').trim());
    const lista = Array.isArray(bruto)
      ? bruto
      : bruto?.projects ?? bruto?.branches ?? bruto?.databases ?? bruto?.roles ?? null;
    if (!Array.isArray(lista)) throw new Error('saída não é uma lista');
    return lista;
  } catch {
    throw new Error(`A CLI Neon retornou uma saída inesperada ao listar ${rotulo}.`);
  }
}

async function escolher(selecionar, itens, mensagem) {
  if (itens.length === 0) throw new Error(`Nenhum item disponível para ${mensagem.toLowerCase()}`);
  if (itens.length === 1) return itens[0].id ?? itens[0].name;
  const valor = await selecionar({
    mensagem,
    opcoes: itens.map((item) => ({ value: item.id ?? item.name, label: item.name ?? item.id })),
  });
  return valor;
}

function extrairUri(saida) {
  const texto = String(saida ?? '').trim();
  if (!texto) throw new Error('A CLI Neon não retornou uma string de conexão.');
  try {
    const json = JSON.parse(texto);
    if (typeof json === 'string') return json;
    return json.connection_string ?? json.connectionString ?? '';
  } catch {
    return texto;
  }
}

function garantirSslmode(uri) {
  try {
    const url = new URL(uri);
    if (!url.searchParams.has('sslmode')) url.searchParams.set('sslmode', 'require');
    return url.toString();
  } catch {
    throw new Error('A string de conexão da Neon não é uma URI PostgreSQL válida.');
  }
}

export async function configurarNeon({
  executar = comandoAssincrono,
  selecionar,
  log = () => {},
  criarCliente = criarClientePostgres,
} = {}) {
  const cli = [...comandoNpx(), '--yes', PACOTE_NEON];

  await verificarComando(
    executar([...cli, 'auth'], { tty: true }),
    'Falha ao executar a CLI Neon ao autenticar. Se o navegador não abrir, execute "npx --yes neon@^2.45.0 auth" manualmente.',
  );

  const projetos = await listarJson(executar, [...cli, 'projects', 'list', '--output', 'json'], 'projetos');
  if (projetos.length === 0) {
    throw new Error('Nenhum projeto encontrado na Neon. Crie um projeto em https://console.neon.tech antes de continuar.');
  }
  const projetoId = await escolher(selecionar, projetos, 'Escolha o projeto Neon:');

  const branches = await listarJson(
    executar,
    [...cli, 'branches', 'list', '--project-id', projetoId, '--output', 'json'],
    'branches',
  );
  const branchId = await escolher(selecionar, branches, 'Escolha a branch Neon:');

  const bancos = await listarJson(
    executar,
    [...cli, 'databases', 'list', '--project-id', projetoId, '--branch', branchId, '--output', 'json'],
    'bancos de dados',
  );
  const banco = await escolher(selecionar, bancos, 'Escolha o banco de dados Neon:');

  const roles = await listarJson(
    executar,
    [...cli, 'roles', 'list', '--project-id', projetoId, '--branch', branchId, '--output', 'json'],
    'roles',
  );
  const role = await escolher(selecionar, roles, 'Escolha a role Neon:');

  const resultado = await verificarComando(
    executar([
      ...cli,
      'connection-string',
      branchId,
      '--project-id', projetoId,
      '--database-name', banco,
      '--role-name', role,
      '--ssl', 'require',
      '--output', 'json',
    ]),
    'Falha ao executar a CLI Neon ao obter a string de conexão.',
  );
  const uri = extrairUri(resultado.stdout);
  if (uri.includes('pooled=true')) {
    throw new Error('A Neon retornou uma conexão pooled. Use uma conexão não pooled (sem "pooled=true").');
  }
  const databaseUrl = garantirSslmode(uri);
  validarUriPostgres(databaseUrl, { exigirSenha: true });
  if (!validarHostSufixo(new URL(databaseUrl).hostname, ['.neon.tech'])) {
    throw new Error('O host da conexão Neon não pertence a *.neon.tech.');
  }
  await provarComCliente(criarCliente, databaseUrl);
  log('Conexão Neon validada (SELECT 1 + objeto temporário).');
  return { databaseUrl };
}
