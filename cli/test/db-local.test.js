import assert from 'node:assert/strict';
import test from 'node:test';

import { POSTGRESAPP, criarBancoDedicado, detectarPostgres, instalarPostgres } from '../src/db/local.js';

const ENOENT = () => Object.assign(new Error('ENOENT'), { code: 'ENOENT' });

function fsSomenteCom(parteDoCaminho) {
  return {
    stat: async (caminho) => {
      if (String(caminho).includes(parteDoCaminho)) return {};
      throw ENOENT();
    },
  };
}

test('detectarPostgres encontra instância loopback existente', async () => {
  const chamadas = [];
  const executar = async (args, opcoes) => {
    chamadas.push({ args, opcoes });
    if (args.includes('--version')) return { exitCode: 0, stdout: 'postgres (PostgreSQL) 16.4', stderr: '' };
    if (args.includes('-c')) return { exitCode: 0, stdout: '1\n', stderr: '' };
    return { exitCode: 1, stdout: '', stderr: '' };
  };

  const resultado = await detectarPostgres({
    executar,
    fs: fsSomenteCom('Postgres.app'),
    plataforma: 'darwin',
  });

  assert.deepEqual(resultado, {
    binDir: '/Applications/Postgres.app/Contents/Versions/16/bin',
    versao: 16,
    instaladoPorNos: false,
  });
  const psql = chamadas.find((c) => c.args.at(-2) === '-c');
  assert.ok(psql, 'deveria rodar o probe psql');
  assert.equal(psql.opcoes.env.PGHOST, '127.0.0.1');
  assert.equal(psql.opcoes.env.PGPORT, '5432');
  assert.equal(psql.opcoes.env.PGDATABASE, 'postgres');
  assert.ok(psql.opcoes.env.PGUSER, 'deveria usar o usuário atual');
});

test('detectarPostgres retorna null quando nenhum binário responde', async () => {
  const executar = async () => ({ exitCode: 1, stdout: '', stderr: '' });
  assert.equal(
    await detectarPostgres({
      executar,
      fs: { stat: async () => { throw ENOENT(); } },
      plataforma: 'darwin',
    }),
    null,
  );
});

test('instalarPostgres darwin baixa, monta, copia e retorna o bin dir', async () => {
  const acoes = [];
  const fs = {
    cp: async (origem, destino, opcoes) => acoes.push(['cp', origem, destino, opcoes]),
    mkdir: async () => {},
    readFile: async () => Buffer.from('download'),
  };
  const executar = async (args) => {
    acoes.push(['exec', args]);
    return { exitCode: 0, stdout: '', stderr: '' };
  };
  const baixar = async (url, destino, opcoes) => acoes.push(['baixar', url, destino, opcoes]);
  const sinal = new AbortController().signal;
  let confirmacoes = 0;
  const confirmar = async () => { confirmacoes += 1; return true; };

  const instalado = await instalarPostgres({
    plataforma: 'darwin',
    arquitetura: 'arm64',
    root: '/root-teste',
    confirmar,
    baixar,
    executar,
    fs,
    sinal,
    hashFn: async () => POSTGRESAPP.sha256,
  });

  assert.equal(String(instalado.binDir).replaceAll('\\','/'), '/root-teste/Postgres.app/Contents/Versions/16/bin');
  assert.match(instalado.superuserPassword, /^[A-Za-z0-9_-]{32}$/);
  assert.ok(confirmacoes >= 4, 'cada passo deveria ser confirmado');
  {
    const encontrado = acoes.find((a) => a[0] === 'baixar');
    assert.deepEqual([encontrado[0], encontrado[1], String(encontrado[2]).replaceAll('\\','/'), encontrado[3]], [
      'baixar',
      POSTGRESAPP.url,
      '/root-teste/downloads/postgresapp.dmg',
      { signal: sinal },
    ]);
  }
  {
    const args = acoes.find((a) => a[1]?.[0] === 'hdiutil' && a[1][1] === 'attach')?.[1];
    assert.deepEqual(args.map((v) => String(v).replaceAll('\\','/')), ['hdiutil', 'attach', '-nobrowse', '-mountpoint', '/root-teste/dmg', '/root-teste/downloads/postgresapp.dmg']);
  }
  {
    const encontrado = acoes.find((a) => a[0] === 'cp');
    assert.deepEqual([encontrado[0], String(encontrado[1]).replaceAll('\\','/'), String(encontrado[2]).replaceAll('\\','/'), encontrado[3]], [
      'cp',
      '/root-teste/dmg/Postgres.app',
      '/root-teste/Postgres.app',
      { recursive: true },
    ]);
  }
  assert.ok(acoes.find((a) => a[1]?.[0] === 'hdiutil' && a[1][1] === 'detach'));
});

test('instalarPostgres rejeita sistema fora da matriz', async () => {
  await assert.rejects(
    instalarPostgres({
      plataforma: 'freebsd',
      arquitetura: 'x64',
      root: '/x',
      confirmar: async () => true,
    }),
    /não é suportado/,
  );
});

test('instalarPostgres Ubuntu usa o cluster gerenciado pelo pacote', async () => {
  const comandos = [];
  const executar = async (args, opcoes) => {
    comandos.push({ args, opcoes });
    if (args.join(' ') === 'apt-cache policy postgresql-16') {
      return { exitCode: 0, stdout: 'Candidate: 16.4-1.pgdg22.04+1\n', stderr: '' };
    }
    return { exitCode: 0, stdout: '', stderr: '' };
  };
  const instalado = await instalarPostgres({
    plataforma: 'linux',
    arquitetura: 'x64',
    distroId: 'ubuntu',
    distroVersion: '22.04',
    confirmar: async () => true,
    executar,
    fs: {
      stat: async () => ({}),
      readFile: async () => '',
    },
  });

  assert.equal(instalado.instaladoPorNos, false);
  assert.ok(comandos.some(({ args }) => args.join(' ') === 'sudo apt-get install -y postgresql-16'));
  assert.equal(comandos.some(({ args }) => args.join(' ') === 'sudo /usr/share/postgresql-common/pgdg/apt.postgresql.org.sh'), false);
});

test('instalarPostgres Ubuntu não instala sem candidato PostgreSQL 16', async () => {
  const comandos = [];
  const executar = async (args) => {
    comandos.push(args);
    return { exitCode: 0, stdout: '', stderr: '' };
  };

  await assert.rejects(
    instalarPostgres({
      plataforma: 'linux', arquitetura: 'x64', distroId: 'debian', distroVersion: '12',
      confirmar: async () => true, executar,
      fs: { stat: async () => ({}), readFile: async () => '' },
    }),
    /PostgreSQL 16 não está disponível/,
  );
  assert.equal(comandos.some((args) => args.join(' ') === 'sudo apt-get install -y postgresql-16'), false);
});

test('instalarPostgres Ubuntu pede confirmação específica para habilitar PGDG', async () => {
  const comandos = [];
  const confirmacoes = [];
  let politicas = 0;
  const executar = async (args, opcoes) => {
    comandos.push({ args, opcoes });
    if (args.join(' ') === 'apt-cache policy postgresql-16') {
      politicas += 1;
      return politicas === 1
        ? { exitCode: 0, stdout: 'Candidate: (none)\n', stderr: '' }
        : { exitCode: 0, stdout: 'Candidate: 16.4-1.pgdg22.04+1\n', stderr: '' };
    }
    return { exitCode: 0, stdout: '', stderr: '' };
  };

  await instalarPostgres({
    plataforma: 'linux', arquitetura: 'x64', distroId: 'ubuntu', distroVersion: '22.04',
    confirmar: async ({ mensagem }) => { confirmacoes.push(mensagem); return true; },
    executar,
    fs: { stat: async () => ({}), readFile: async () => '' },
  });

  assert.ok(confirmacoes.some((mensagem) => mensagem.includes('repositório oficial PGDG')));
  const repo = comandos.find(({ args }) => args.join(' ') === 'sudo /usr/share/postgresql-common/pgdg/apt.postgresql.org.sh');
  assert.equal(repo.opcoes.input, '\n');
});

test('criarBancoDedicado cria role e banco com senha aleatória', async () => {
  const comandos = [];
  const executar = async (args, opcoes) => {
    comandos.push({ args, opcoes });
    return { exitCode: 0, stdout: '', stderr: '' };
  };

  const resultado = await criarBancoDedicado({
    binDir: '/bin-teste',
    root: '/root-teste',
    porta: 5432,
    instaladoPorNos: false,
    executar,
    fs: { stat: async () => { throw ENOENT(); }, mkdir: async () => {} },
    plataforma: 'darwin',
  });

  assert.match(
    resultado.databaseUrl,
    /^postgresql:\/\/geronticare_app:[A-Za-z0-9_-]{32}@127\.0\.0\.1:5432\/geronticare$/,
  );
  assert.match(resultado.senha, /^[A-Za-z0-9_-]{32}$/);
  const criar = comandos.find((c) => c.opcoes?.input?.startsWith('CREATE ROLE geronticare_app'));
  assert.ok(criar, 'deveria criar a role');
  assert.ok(criar.opcoes.input.includes(`PASSWORD '${resultado.senha}'`));
  assert.ok(!criar.args.join(' ').includes(resultado.senha), 'senha não pode entrar em argv');
  assert.ok(comandos.find((c) => c.opcoes?.input === 'CREATE DATABASE geronticare OWNER geronticare_app'));
});

test('criarBancoDedicado é idempotente quando role e banco já existem', async () => {
  const comandos = [];
  const executar = async (args, opcoes) => {
    comandos.push({ args, opcoes });
    const sql = opcoes.input;
    if (sql.startsWith('CREATE ROLE')) {
      return { exitCode: 1, stdout: '', stderr: 'ERROR: role "geronticare_app" already exists\n' };
    }
    if (sql.startsWith('CREATE DATABASE')) {
      return { exitCode: 1, stdout: '', stderr: 'ERROR: database "geronticare" already exists\n' };
    }
    return { exitCode: 0, stdout: '', stderr: '' };
  };

  const resultado = await criarBancoDedicado({
    binDir: '/bin-teste',
    root: '/root-teste',
    instaladoPorNos: false,
    executar,
    fs: { stat: async () => { throw ENOENT(); }, mkdir: async () => {} },
    plataforma: 'darwin',
  });

  const alter = comandos.find((c) => c.opcoes.input.startsWith('ALTER ROLE geronticare_app'));
  assert.ok(alter, 'deveria atualizar a senha da role existente');
  assert.ok(alter.opcoes.input.includes(`PASSWORD '${resultado.senha}'`));
  assert.match(resultado.databaseUrl, /geronticare_app:/);
});

test('criarBancoDedicado nunca expõe a senha em erros', async () => {
  let senha = '';
  const executar = async (_args, opcoes) => {
    const sql = opcoes.input;
    if (sql.startsWith('CREATE ROLE')) {
      senha = (sql.match(/PASSWORD '([^']+)'/) ?? [])[1];
      return {
        exitCode: 1,
        stdout: '',
        stderr: `ERROR: role "geronticare_app" already exists\n${sql}\n`,
      };
    }
    if (sql.startsWith('ALTER ROLE')) return { exitCode: 0, stdout: '', stderr: '' };
    if (sql.startsWith('CREATE DATABASE')) {
      return { exitCode: 1, stdout: '', stderr: `ERROR: syntax error\n${sql}\n` };
    }
    return { exitCode: 1, stdout: '', stderr: 'falha misteriosa' };
  };

  await assert.rejects(
    criarBancoDedicado({
      binDir: '/bin-teste',
      root: '/root-teste',
      instaladoPorNos: false,
      executar,
      fs: { stat: async () => { throw ENOENT(); }, mkdir: async () => {} },
      plataforma: 'darwin',
    }),
    (erro) => {
      assert.ok(senha, 'o cenário deveria ter uma senha');
      assert.ok(!erro.message.includes(senha), 'a mensagem não pode conter a senha');
      assert.match(erro.message, /Falha ao criar o banco geronticare/);
      return true;
    },
  );
});

test('criarBancoDedicado inicializa e inicia o cluster próprio', async () => {
  const comandos = [];
  const executar = async (args, opcoes) => {
    comandos.push({ args, opcoes });
    return { exitCode: 0, stdout: '', stderr: '' };
  };
  const confirmacoes = [];
  const confirmar = async ({ mensagem }) => { confirmacoes.push(mensagem); return true; };
  const fs = {
    stat: async () => { throw ENOENT(); },
    mkdir: async () => {},
    writeFile: async () => {},
    rm: async () => {},
  };

  const resultado = await criarBancoDedicado({
    binDir: '/bin-teste',
    root: '/root-teste',
    porta: 5555,
    instaladoPorNos: true,
    confirmar,
    executar,
    fs,
    plataforma: 'darwin',
  });

  {
    const initdb = comandos.find((a) => String(a.args[0]).replaceAll('\\','/').endsWith('initdb'));
    assert.deepEqual(initdb.args.map((v) => String(v).replaceAll('\\','/')), [
      '/bin-teste/initdb',
      '-D', '/root-teste/pgdata',
      '-U', 'postgres',
      '--auth-local=trust',
      '--auth-host=scram-sha-256',
      '--pwfile', '/root-teste/tmp/postgres-superuser.password',
      '-E', 'UTF8',
    ]);
  }
  assert.ok(comandos.find((a) => String(a.args[0]).replaceAll('\\','/').endsWith('pg_ctl')));
  assert.ok(comandos.find((a) => String(a.args[0]).replaceAll('\\','/').endsWith('pg_isready')));
  assert.match(resultado.databaseUrl, /@127\.0\.0\.1:5555\/geronticare$/);
  assert.ok(confirmacoes.length >= 1);
});
