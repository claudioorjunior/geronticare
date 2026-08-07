export type DevSeedUser = {
  email: string;
  password: string;
  name: string;
  role: 'admin' | 'profissional' | 'usuario';
};

const SEED_USER_DEFINITIONS = [
  { email: 'admin@mock.ilpi', passwordEnv: 'SEED_ADMIN_PASSWORD', name: 'Admin Mock', role: 'admin' },
  { email: 'profissional@mock.ilpi', passwordEnv: 'SEED_PROFISSIONAL_PASSWORD', name: 'Dr. Mock', role: 'profissional' },
  { email: 'leitor@mock.ilpi', passwordEnv: 'SEED_LEITOR_PASSWORD', name: 'Leitor Mock', role: 'usuario' },
] as const;

export function loadDevSeedUsers(
  environment: NodeJS.ProcessEnv = process.env,
): DevSeedUser[] {
  if (environment.NODE_ENV === 'production') {
    throw new Error('Seed de usuários de desenvolvimento bloqueado em produção');
  }
  if (environment.SEED_DEV_USERS !== 'true') {
    throw new Error('Defina SEED_DEV_USERS=true para executar o seed de desenvolvimento');
  }

  return SEED_USER_DEFINITIONS.map(({ passwordEnv, ...definition }) => {
    const password = environment[passwordEnv];
    if (!password || password.length < 12) {
      throw new Error(`${passwordEnv} deve conter pelo menos 12 caracteres`);
    }
    return { ...definition, password };
  });
}
