import { z } from 'zod';
import { createTRPCRouter, protectedProcedure, adminProcedure } from '../server';
import { usuarios } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';

export const usuariosRouter = createTRPCRouter({
  listar: adminProcedure.query(async ({ ctx }) => {
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

  buscar: adminProcedure
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

  atualizar: adminProcedure
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

      // Previne que o admin desative a si mesmo (trava instituição sem gestor)
      if (id === ctx.userId && data.ativo === false) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Você não pode desativar a própria conta',
        });
      }

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

  desativar: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      // Previne auto-desativação
      if (input.id === ctx.userId) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Você não pode desativar a própria conta',
        });
      }

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

  // Perfil próprio — qualquer papel pode ver/editar apenas os próprios dados básicos
  meuPerfil: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.query.usuarios.findFirst({
      where: eq(usuarios.id, ctx.userId),
      columns: {
        id: true,
        nome: true,
        email: true,
        especialidade: true,
        registroProfissional: true,
        role: true,
      },
    });
  }),

  atualizarMeuPerfil: protectedProcedure
    .input(
      z.object({
        nome: z.string().min(3).optional(),
        registroProfissional: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [usuario] = await ctx.db
        .update(usuarios)
        .set(input)
        .where(eq(usuarios.id, ctx.userId))
        .returning({
          id: usuarios.id,
          nome: usuarios.nome,
          email: usuarios.email,
        });
      return usuario;
    }),
});
