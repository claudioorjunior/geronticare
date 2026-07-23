import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '../server';
import { instituicoes } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export const instituicoesRouter = createTRPCRouter({
  buscar: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.query.instituicoes.findFirst({
      where: eq(instituicoes.id, ctx.instituicaoId),
    });
  }),

  atualizar: protectedProcedure
    .input(
      z.object({
        nome: z.string().min(3).optional(),
        cnpj: z.string().optional(),
        telefone: z.string().optional(),
        email: z.string().email().optional(),
        endereco: z.object({
          logradouro: z.string(),
          numero: z.string(),
          complemento: z.string().optional(),
          bairro: z.string(),
          cidade: z.string(),
          estado: z.string(),
          cep: z.string(),
        }).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [instituicao] = await ctx.db
        .update(instituicoes)
        .set(input)
        .where(eq(instituicoes.id, ctx.instituicaoId))
        .returning();
      return instituicao;
    }),
});
