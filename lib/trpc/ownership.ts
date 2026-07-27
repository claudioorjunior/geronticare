import { pacientes } from '@/lib/db/schema';
import type { Db } from '@/lib/db';
import { eq, and } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';

/**
 * Verifica que um paciente pertence à instituição do usuário logado.
 * Helper compartilhado — antes triplicado em 3 routers (bug #4).
 *
 * @throws TRPCError NOT_FOUND se paciente não existe ou não pertence à instituição
 */
export async function verificarOwnershipPaciente(
  db: Db,
  pacienteId: string,
  instituicaoId: string,
) {
  const paciente = await db.query.pacientes.findFirst({
    where: and(
      eq(pacientes.id, pacienteId),
      eq(pacientes.instituicaoId, instituicaoId),
    ),
  });
  if (!paciente) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'Paciente não encontrado ou não pertence à sua instituição',
    });
  }
  return paciente;
}
