'use client';

import { trpc } from '@/lib/trpc/client';

export type UserRole = 'admin' | 'profissional' | 'usuario';

/**
 * Papel efetivo do usuário autenticado, carregado do perfil persistido no servidor.
 * Ausência de perfil significa que o papel ainda não foi resolvido.
 */
export function useUserRole() {
  const perfilQuery = trpc.usuarios.meuPerfil.useQuery();

  return {
    ...perfilQuery,
    role: perfilQuery.data?.role ?? null,
    permissions: perfilQuery.data?.permissoes ?? [],
  };
}
