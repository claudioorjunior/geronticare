import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '../server';
import { usuarios } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

export const usuariosRouter = createTRPCRouter({
  listar: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.query.usuarios.findMany({
      where: eq(usuarios.instituicaoId, ctx.instituicaoId),
      columns: {
        id: true,
        nome: true,
        email: true,
        especialidade: true,
        registroProfissional: true,
        ativo: true,
        createdAt: true,
      },
    });
  }),

  buscar: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.query.usuarios.findFirst({
        where: and(
          eq(usuarios.id, input.id),
          eq(usuarios.instituicaoId, ctx.instituicaoId)
        ),
        columns: {
          id: true,
          nome: true,
          email: true,
          especialidade: true,
          registroProfissional: true,
          ativo: true,
          createdAt: true,
        },
      });
    }),

  atualizar: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        nome: z.string().min(3).optional(),
        especialidade: z.enum(['medicina', 'enfermagem', 'fisioterapia', 'terapia_ocupacional', 'fonoaudiologia', 'nutricao', 'psicologia', 'servico_social']).optional(),
        registroProfissional: z.string().optional(),
        ativo: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const [usuario] = await ctx.db
        .update(usuarios)
        .set(data)
        .where(
          and(
            eq(usuarios.id, id),
            eq(usuarios.instituicaoId, ctx.instituicaoId)
          )
        )
        .returning({
          id: usuarios.id,
          nome: usuarios.nome,
          email: usuarios.email,
          especialidade: usuarios.especialidade,
          ativo: usuarios.ativo,
        });
      return usuario;
    }),

  desativar: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(usuarios)
        .set({ ativo: false })
        .where(
          and(
            eq(usuarios.id, input.id),
            eq(usuarios.instituicaoId, ctx.instituicaoId)
          )
        );
      return { success: true };
    }),
});
