import { z } from 'zod';
import { createTRPCRouter, adminProcedure } from '../server';
import { cargos } from '@/lib/db/schema';
import { PERMISSOES_ATRIBUIVEIS } from '@/lib/permissoes';
import { eq, and } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';

/**
 * Cargos customizados (RBAC dinâmico).
 *
 * O gestor cria cargos e escolhe permissões do catálogo fechado
 * (`clinico:ler`, `clinico:editar` — ver `lib/permissoes.ts`). A permissão
 * administrativa total pertence somente ao papel `admin` e não é atribuível.
 * Formato `modulo:acao` escala para módulos futuros do ERP (financeiro,
 * juridico, logistica...). Um cargo NUNCA remove permissões do papel — ele só
 * adiciona permissões ao usuário que o recebe. Ex.: usuário com papel
 * `usuario` (leitura) + cargo "Jurídico" (`clinico:editar`) passa a poder
 * editar registros clínicos.
 */
export const cargosRouter = createTRPCRouter({
  listar: adminProcedure.query(async ({ ctx }) => {
    return ctx.db.query.cargos.findMany({
      where: eq(cargos.instituicaoId, ctx.instituicaoId),
      orderBy: (cargos, { asc }) => [asc(cargos.nome)],
    });
  }),

  criar: adminProcedure
    .input(
      z.object({
        nome: z.string().min(3).max(60),
        descricao: z.string().max(240).optional(),
        permissoes: z.array(z.enum(PERMISSOES_ATRIBUIVEIS)).min(1, 'Selecione ao menos uma permissão'),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Audit: nome duplicado na mesma instituição (unique constraint com mensagem clara).
      const existente = await ctx.db.query.cargos.findFirst({
        where: and(
          eq(cargos.instituicaoId, ctx.instituicaoId),
          eq(cargos.nome, input.nome.trim()),
        ),
        columns: { id: true },
      });
      if (existente) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Já existe um cargo com este nome',
        });
      }

      const [cargo] = await ctx.db
        .insert(cargos)
        .values({
          instituicaoId: ctx.instituicaoId,
          nome: input.nome.trim(),
          descricao: input.descricao?.trim() || null,
          permissoes: [...new Set(input.permissoes)],
        })
        .returning();

      return cargo;
    }),

  atualizar: adminProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        nome: z.string().min(3).max(60).optional(),
        descricao: z.string().max(240).nullable().optional(),
        permissoes: z.array(z.enum(PERMISSOES_ATRIBUIVEIS)).min(1).optional(),
        ativo: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;

      const [cargo] = await ctx.db
        .update(cargos)
        .set(
          data.nome !== undefined
            ? { ...data, nome: data.nome.trim() }
            : data
        )
        .where(
          and(
            eq(cargos.id, id),
            eq(cargos.instituicaoId, ctx.instituicaoId)
          )
        )
        .returning();

      if (!cargo) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Cargo não encontrado',
        });
      }

      return cargo;
    }),

  desativar: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [cargo] = await ctx.db
        .update(cargos)
        .set({ ativo: false })
        .where(
          and(
            eq(cargos.id, input.id),
            eq(cargos.instituicaoId, ctx.instituicaoId)
          )
        )
        .returning({ id: cargos.id, ativo: cargos.ativo });

      if (!cargo) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Cargo não encontrado',
        });
      }

      return cargo;
    }),
});
