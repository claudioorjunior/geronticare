/**
 * Políticas de autorização por papel — matriz de acesso do GerontiCare.
 *
 * Papéis: `admin`, `profissional`, `usuario` (leitura administrativa).
 *
 * | Papel        | Ler dados do paciente | Ler AGA/relatório | Alterar dados clínicos |
 * |--------------|:--------------------:|:-----------------:|:----------------------:|
 * | admin        | sim                  | sim               | sim                    |
 * | profissional | sim                  | sim               | sim                    |
 * | usuario      | sim                  | sim               | não                    |
 *
 * Funções puras e sem dependências para serem testadas isoladamente.
 */

export type UserRole = 'admin' | 'profissional' | 'usuario';

/** Leitura clínica: inclui o papel administrativo `usuario`. */
export function podeLerClinico(role: string | null | undefined): role is UserRole {
  return role === 'admin' || role === 'profissional' || role === 'usuario';
}

/** Escrita clínica: AGA, registros, sinais vitais. */
export function podeAcessarClinico(role: string | null | undefined): role is 'admin' | 'profissional' {
  return role === 'admin' || role === 'profissional';
}

/** Operações administrativas (ex.: desativar paciente). */
export function podeAdministrar(role: string | null | undefined): role is 'admin' {
  return role === 'admin';
}

/**
 * Bypass de autenticação para desenvolvimento local (fail-closed).
 * Exige as DUAS condições: NODE_ENV=development E DEV_AUTH_BYPASS=true.
 * Em produção (NODE_ENV=production) nunca ativa, mesmo com a variável setada.
 */
export function devBypassAtivo(env: Record<string, string | undefined> = process.env): boolean {
  return env.NODE_ENV === 'development' && env.DEV_AUTH_BYPASS === 'true';
}
