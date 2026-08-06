/**
 * Políticas de autorização do GerontiCare — matriz de acesso.
 *
 * Papéis: `admin`, `profissional`, `usuario` (leitura administrativa).
 * Cargos: customizados pelo gestor; ADICIONAM permissões ao papel (nunca removem).
 * Permissões: formato `modulo:acao` (catálogo fechado em `lib/permissoes.ts`),
 * escalável para módulos futuros (financeiro, juridico, logistica...).
 *
 * | Papel        | clinico:ler | clinico:editar | admin:administrar |
 * |--------------|:-----------:|:--------------:|:------------------:|
 * | admin        | sim         | sim            | sim                |
 * | profissional | sim         | sim            | não                |
 * | usuario      | sim         | não            | não                |
 *
 * Funções puras e sem dependências para serem testadas isoladamente.
 */
import type { Permissao } from '@/lib/permissoes';
import { PERMISSOES } from '@/lib/permissoes';

export type UserRole = 'admin' | 'profissional' | 'usuario';

/** Permissões base por papel — sem cargo, é exatamente esta matriz. */
export const PERMISSOES_BASE: Record<UserRole, Permissao[]> = {
  admin: ['clinico:ler', 'clinico:editar', 'admin:administrar'],
  profissional: ['clinico:ler', 'clinico:editar'],
  usuario: ['clinico:ler'],
};

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
 * Permissões efetivas de um usuário: base do papel + permissões do cargo.
 * Cargo nunca remove — o papel é o piso de acesso (fail-safe; admin não
 * perde `administrar` por cargo).
 */
export function permissaoEfetiva(
  role: string | null | undefined,
  cargoPermissoes?: Permissao[] | null,
): Permissao[] {
  const base = (role && PERMISSOES_BASE[role as UserRole]) ?? [];
  // Fail-closed: só entram permissões do catálogo canônico (nunca strings soltas).
  const cargo = (cargoPermissoes ?? []).filter((p): p is Permissao =>
    PERMISSOES.includes(p as Permissao),
  );
  return [...new Set([...base, ...cargo])] as Permissao[];
}

/** Checa permissão efetiva (retorna false para contexto sem permissões). */
export function temPermissao(
  permissoes: Permissao[] | null | undefined,
  permissao: Permissao,
): boolean {
  return !!permissoes?.includes(permissao);
}

/**
 * Bypass de autenticação para desenvolvimento local (fail-closed).
 * Exige as DUAS condições: NODE_ENV=development E DEV_AUTH_BYPASS=true.
 * Em produção (NODE_ENV=production) nunca ativa, mesmo com a variável setada.
 */
export function devBypassAtivo(env: Record<string, string | undefined> = process.env): boolean {
  return env.NODE_ENV === 'development' && env.DEV_AUTH_BYPASS === 'true';
}
