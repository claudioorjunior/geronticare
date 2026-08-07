import { z } from 'zod';
import { createTRPCRouter, adminProcedure } from '../server';
import { instituicoes } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';

export const instituicoesRouter = createTRPCRouter({
  buscar: adminProcedure.query(async ({ ctx }) => {
    // React Query rejeita `undefined`; findFirst sem match vira null.
    return (await ctx.db.query.instituicoes.findFirst({
      where: eq(instituicoes.id, ctx.instituicaoId),
    })) ?? null;
  }),

  atualizar: adminProcedure
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

      if (!instituicao) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Instituição não encontrada',
        });
      }

      return instituicao;
    }),
});
