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

/** Escrita clínica: AGA, registros, sinais vitais. */
export function podeAcessarClinico(role: string | null | undefined): role is 'admin' | 'profissional' {
  return role === 'admin' || role === 'profissional';
}

/** Operações administrativas (ex.: desativar paciente). */
export function podeAdministrar(role: string | null | undefined): role is 'admin' {
  return role === 'admin';
}
