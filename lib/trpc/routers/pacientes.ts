import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '../server';
import { pacientes } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export const pacientesRouter = createTRPCRouter({
  listar: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.query.pacientes.findMany({
      where: eq(pacientes.ativo, true),
      orderBy: (pacientes, { desc }) => [desc(pacientes.createdAt)],
    });
  }),

  buscar: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.query.pacientes.findFirst({
        where: eq(pacientes.id, input.id),
      });
    }),

  criar: protectedProcedure
    .input(
      z.object({
        nome: z.string().min(3),
        dataNascimento: z.date(),
        cpf: z.string().optional(),
        sexo: z.enum(['masculino', 'feminino', 'outro']),
        telefone: z.string().optional(),
        dataAdmissao: z.date(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [novoPaciente] = await ctx.db
        .insert(pacientes)
        .values({
          ...input,
          instituicaoId: 'temp-instituicao-id',
        })
        .returning();
      return novoPaciente;
    }),
});
