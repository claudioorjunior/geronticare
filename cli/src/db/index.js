import { ErroCancelado } from '../ui.js';
import {
  criarBancoDedicado,
  detectarPostgres,
  instalarPostgres,
  PORTA_POSTGRES_PADRAO,
  validarBinarioPostgres,
  validarPostgresLocal,
} from './local.js';
import { configurarNeon } from './neon.js';
import { configurarSupabase } from './supabase.js';

async function configurarLocal(deps) {
  const detectado = await detectarPostgres(deps);
  if (detectado && (detectado.versao < 16 || detectado.versao > 18)) {
    throw new Error('A instância PostgreSQL encontrada não é suportada. Use PostgreSQL 16, 17 ou 18, ou escolha Neon/Supabase.');
  }
  if (detectado) {
    const superuserPassword = deps.plataforma === 'win32'
      ? String((await deps.pedirSenhaSuperuser?.({ mensagem: 'Senha da role postgres do PostgreSQL local:' })) ?? '')
      : undefined;
    if (deps.plataforma === 'win32' && !superuserPassword) {
      throw new Error('A senha da role postgres é necessária para usar o PostgreSQL local no Windows.');
    }
    if (deps.plataforma === 'win32') {
      await validarPostgresLocal({
        binDir: detectado.binDir,
        porta: deps.portaPostgres ?? PORTA_POSTGRES_PADRAO,
        executar: deps.executar,
        senha: superuserPassword,
      });
    }
    const { databaseUrl } = await criarBancoDedicado({
      ...deps,
      porta: deps.portaPostgres ?? PORTA_POSTGRES_PADRAO,
      binDir: detectado.binDir,
      instaladoPorNos: false,
      superuserPassword,
    });
    return {
      databaseUrl,
      provedor: 'local',
      providerInfo: { binDir: detectado.binDir, versao: detectado.versao },
    };
  }

  if (!(await deps.confirmar({ mensagem: 'Nenhum PostgreSQL local foi encontrado. Instalar o PostgreSQL 16?' }))) {
    throw new ErroCancelado();
  }
  const instalado = await instalarPostgres(deps);
  const versao = await validarBinarioPostgres({ binDir: instalado.binDir, executar: deps.executar });
  const { databaseUrl } = await criarBancoDedicado({
    ...deps,
    porta: deps.portaPostgres ?? PORTA_POSTGRES_PADRAO,
    ...instalado,
    instaladoPorNos: instalado.instaladoPorNos ?? true,
  });
  return { databaseUrl, provedor: 'local', providerInfo: { binDir: instalado.binDir, versao } };
}

export async function configurarBanco({ provedor, ...deps }) {
  if (provedor === 'local') {
    return configurarLocal(deps);
  }
  if (provedor === 'neon') {
    const { databaseUrl } = await configurarNeon(deps);
    return { databaseUrl, provedor: 'neon' };
  }
  if (provedor === 'supabase') {
    const { databaseUrl } = await configurarSupabase(deps);
    return { databaseUrl, provedor: 'supabase' };
  }
  throw new Error(`Provedor de banco de dados desconhecido: ${provedor}.`);
}
