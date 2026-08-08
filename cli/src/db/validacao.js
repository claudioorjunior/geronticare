import { randomBytes } from 'node:crypto';

const SENHAS_PLACEHOLDER = new Set(['***', 'senha', 'password', 'your_password', 'PASSWORD']);

export function validarUriPostgres(uri, { exigirSenha = true } = {}) {
  const texto = String(uri ?? '').trim();
  let url;
  try {
    url = new URL(texto);
  } catch {
    throw new Error('A URL do banco de dados não é uma URI PostgreSQL válida.');
  }
  if (url.protocol !== 'postgres:' && url.protocol !== 'postgresql:') {
    throw new Error('A URL do banco de dados deve usar o protocolo postgres:// ou postgresql://.');
  }
  if (exigirSenha && !url.password) {
    throw new Error('A URL do banco de dados deve incluir uma senha.');
  }
  if (SENHAS_PLACEHOLDER.has(url.password)) {
    throw new Error('A URL do banco de dados contém uma senha de exemplo. Substitua pela senha real.');
  }
  return texto;
}

export function validarHostSufixo(host, sufixos) {
  return sufixos.some((sufixo) => String(host).endsWith(sufixo));
}

export function gerarSenhaBanco(bytes = 24) {
  return randomBytes(bytes).toString('base64url');
}

export async function criarClientePostgres(uri) {
  const { default: postgres } = await import('postgres');
  return postgres(uri, { max: 1, prepare: false });
}

export async function provarBanco(cliente) {
  try {
    await cliente`SELECT 1`;
    await cliente.unsafe('CREATE TEMPORARY TABLE geronticare_prova (id integer)');
    await cliente.unsafe('DROP TABLE geronticare_prova');
  } catch {
    try {
      await cliente.end();
    } catch {
      // encerrar o cliente é best-effort
    }
    throw new Error('Não foi possível conectar ao banco de dados.');
  }
}

export async function provarComCliente(criarCliente, uri) {
  let cliente;
  try {
    cliente = await criarCliente(uri);
    await provarBanco(cliente);
    await versaoPostgres(cliente);
  } catch {
    try {
      await cliente?.end();
    } catch {
      // best-effort
    }
    throw new Error('Não foi possível conectar ao banco de dados.');
  } finally {
    if (cliente) {
      try {
        await cliente.end?.();
      } catch {
        // best-effort: a validação concluída não deve deixar conexão aberta
      }
    }
  }
}

export async function versaoPostgres(cliente) {
  const [linha] = await cliente`SELECT current_setting('server_version') AS versao`;
  const major = Number.parseInt(String(linha?.versao ?? ''), 10);
  if (Number.isNaN(major)) {
    throw new Error('Não foi possível identificar a versão do PostgreSQL.');
  }
  if (major < 16 || major > 18) {
    throw new Error(`Versão do PostgreSQL ${major} não é suportada. São suportadas as versões 16, 17 e 18.`);
  }
  return major;
}
