import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '../server';
import { sinaisVitais, pacientes } from '@/lib/db/schema';
import { eq, and, gte, lte } from 'drizzle-orm';
import { sinalVitalSchema } from '@/lib/validations/escalas';

export const sinaisVitaisRouter = createTRPCRouter({
  listar: protectedProcedure
    .input(
      z.object({
        pacienteId: z.string().uuid(),
        dataInicio: z.coerce.date().optional(),
        dataFim: z.coerce.date().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { pacienteId, dataInicio, dataFim } = input;

      const condicoes = [eq(sinaisVitais.pacienteId, pacienteId)];
      if (dataInicio) condicoes.push(gte(sinaisVitais.dataAfericao, dataInicio));
      if (dataFim) condicoes.push(lte(sinaisVitais.dataAfericao, dataFim));

      return ctx.db.query.sinaisVitais.findMany({
        where: and(...condicoes),
        orderBy: (sinaisVitais, { desc }) => [desc(sinaisVitais.dataAfericao)],
      });
    }),

  registrar: protectedProcedure
    .input(sinalVitalSchema)
    .mutation(async ({ ctx, input }) => {
      const paciente = await ctx.db.query.pacientes.findFirst({
        where: and(
          eq(pacientes.id, input.pacienteId),
          eq(pacientes.instituicaoId, ctx.instituicaoId!)
        ),
      });

      if (!paciente) {
        throw new Error('Paciente não encontrado');
      }

      const [novoSinal] = await ctx.db
        .insert(sinaisVitais)
        .values({
          ...input,
          profissionalId: ctx.userId!,
        })
        .returning();

      return novoSinal;
    }),

  ultimo: protectedProcedure
    .input(z.object({ pacienteId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.query.sinaisVitais.findFirst({
        where: eq(sinaisVitais.pacienteId, input.pacienteId),
        orderBy: (sinaisVitais, { desc }) => [desc(sinaisVitais.dataAfericao)],
      });
    }),
});
