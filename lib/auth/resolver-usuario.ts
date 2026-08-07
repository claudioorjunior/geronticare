import type { Db } from '@/lib/db';
import { usuarios } from '@/lib/db/schema';
import { obterEstadoBootstrap } from '@/lib/bootstrap';
import { permissaoEfetiva } from '@/lib/trpc/autorizacao';
import { eq } from 'drizzle-orm';

/**
 * Resolve instituição, papel, status e permissões efetivas de uma identidade.
 * Route handlers e tRPC compartilham esta função para aplicar a mesma política.
 */
export async function resolverUsuarioAutorizacao(db: Db, userId: string) {
  const estadoBootstrap = await obterEstadoBootstrap(db);
  if (estadoBootstrap.necessario || estadoBootstrap.inconsistente) return null;

  const user = await db.query.usuarios.findFirst({
    where: eq(usuarios.id, userId),
    columns: { instituicaoId: true, role: true, ativo: true },
    with: {
      cargo: {
        columns: { permissoes: true, ativo: true },
      },
    },
  });

  if (!user) return null;

  return {
    ...user,
    permissoes: permissaoEfetiva(
      user.role,
      user.cargo?.ativo ? user.cargo.permissoes : undefined,
    ),
  };
}
