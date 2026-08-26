import { z } from 'zod';
import { createTRPCRouter, protectedProcedure, adminProcedure } from '../server';
import { usuarios, accounts, cargos } from '@/lib/db/schema';
import { eq, and, or, isNotNull, count } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { hashPassword } from 'better-auth/crypto';
import type { Db } from '@/lib/db';
import { urlHttpSchema } from '@/lib/validations/url';

const ESPECIALIDADES = ['medicina', 'enfermagem', 'fisioterapia', 'terapia_ocupacional', 'fonoaudiologia', 'nutricao', 'psicologia', 'servico_social'] as const;

function isUniqueViolation(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  if ('code' in error && error.code === '23505') return true;
  return 'cause' in error && isUniqueViolation(error.cause);
}

/**
 * Valida que o cargo existe e pertence à instituição do contexto.
 * Retorna null quando cargoId é undefined (campo opcional); lança FORBIDDEN
 * quando o cargo é de outra instituição (defesa em profundidade multi-tenant).
 */
async function validarCargoDaInstituicao(
  db: Db,
  instituicaoId: string,
  cargoId: string | null | undefined,
) {
  if (!cargoId) return;
  const cargo = await db.query.cargos.findFirst({
    where: and(
      eq(cargos.id, cargoId),
      eq(cargos.instituicaoId, instituicaoId),
      eq(cargos.ativo, true),
    ),
    columns: { id: true },
  });
  if (!cargo) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Cargo inválido ou inativo para esta instituição',
    });
  }
}

/**
 * Guarda do último admin ativo: impede rebaixar ou desativar o único admin
 * restante da instituição (lockout — a instituição ficaria sem gestor).
 */
async function garantirNaoUltimoAdmin(
  db: Db,
  instituicaoId: string,
  alvoId: string,
) {
  const alvo = await db.query.usuarios.findFirst({
    where: and(
      eq(usuarios.id, alvoId),
      eq(usuarios.instituicaoId, instituicaoId),
    ),
    columns: { role: true, ativo: true },
  });
  if (!alvo?.ativo || alvo.role !== 'admin') return;

  const [ativos] = await db
    .select({ value: count() })
    .from(usuarios)
    .where(
      and(
        eq(usuarios.instituicaoId, instituicaoId),
        eq(usuarios.role, 'admin'),
        eq(usuarios.ativo, true)
      )
    );
  if (Number(ativos?.value ?? 0) <= 1) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Não é possível alterar o único admin ativo da instituição',
    });
  }
}

export const usuariosRouter = createTRPCRouter({
  listarProfissionaisAtivos: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.query.usuarios.findMany({
      where: and(
        eq(usuarios.instituicaoId, ctx.instituicaoId),
        eq(usuarios.ativo, true),
        or(eq(usuarios.role, 'admin'), eq(usuarios.role, 'profissional')),
        isNotNull(usuarios.especialidade),
      ),
      orderBy: (usuarios, { asc }) => [asc(usuarios.nome)],
      columns: {
        id: true,
        nome: true,
        especialidade: true,
        registroProfissional: true,
      },
    });
  }),

  listar: adminProcedure.query(async ({ ctx }) => {
    return ctx.db.query.usuarios.findMany({
      where: eq(usuarios.instituicaoId, ctx.instituicaoId),
      with: { cargo: { columns: { id: true, nome: true, permissoes: true } } },
      columns: {
        id: true,
        nome: true,
        email: true,
        role: true,
        cargoId: true,
        especialidade: true,
        registroProfissional: true,
        ativo: true,
        createdAt: true,
      },
      orderBy: (usuarios, { asc }) => [asc(usuarios.nome)],
    });
  }),

  buscar: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      // React Query rejeita `undefined`; findFirst sem match vira null.
      return (await ctx.db.query.usuarios.findFirst({
        where: and(
          eq(usuarios.id, input.id),
          eq(usuarios.instituicaoId, ctx.instituicaoId)
        ),
        with: { cargo: { columns: { id: true, nome: true, permissoes: true } } },
        columns: {
          id: true,
          nome: true,
          email: true,
          role: true,
          cargoId: true,
          especialidade: true,
          registroProfissional: true,
          ativo: true,
          createdAt: true,
        },
      })) ?? null;
    }),

  /**
   * Criação de usuário pelo admin (provisão sem e-mail — decisão T-45):
   * senha inicial informada em mão; o usuário troca depois em /perfil.
   * Hash com o mesmo algoritmo do Better-Auth (credential account).
   */
  criar: adminProcedure
    .input(
      z.object({
        nome: z.string().min(3),
        email: z.string().email(),
        senha: z.string().min(8),
        role: z.enum(['admin', 'profissional', 'usuario']).default('profissional'),
        cargoId: z.string().uuid().nullable().optional(),
        especialidade: z.enum(ESPECIALIDADES).optional(),
        registroProfissional: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { senha, role, especialidade, registroProfissional } = input;

      // Audit: verifica e-mail duplicado ANTES de inserir (mensagem clara, sem depender do DB).
      // SEGURANÇA: o filtro é por instituição. O e-mail é unique global no
      // schema (constraint do Better-Auth), então um e-mail de outra instituição
      // ainda falha no INSERT — mas a mensagem NÃO revela a existência cross-tenant
      // (evita oráculo de enumeração de e-mails entre instituições).
      const existente = await ctx.db.query.usuarios.findFirst({
        where: and(
          eq(usuarios.email, input.email.toLowerCase()),
          eq(usuarios.instituicaoId, ctx.instituicaoId)
        ),
        columns: { id: true },
      });
      if (existente) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Não foi possível cadastrar este e-mail',
        });
      }

      const senhaHash = await hashPassword(senha);
      await validarCargoDaInstituicao(ctx.db, ctx.instituicaoId, input.cargoId);

      try {
        return await ctx.db.transaction(async (tx) => {
          const [usuario] = await tx
            .insert(usuarios)
            .values({
              instituicaoId: ctx.instituicaoId,
              nome: input.nome,
              email: input.email.toLowerCase(),
              role,
              cargoId: input.cargoId ?? null,
              especialidade,
              registroProfissional,
            })
            .returning({ id: usuarios.id });

          // Credential account do Better-Auth — mesmo shape do signUp interno.
          // Os dois inserts ficam na mesma transação: sem credencial, o usuário
          // também é revertido e o e-mail não fica reservado.
          await tx.insert(accounts).values({
            userId: usuario.id,
            providerId: 'credential',
            accountId: usuario.id,
            password: senhaHash,
          });

          return { id: usuario.id };
        });
      } catch (error) {
        // O e-mail é uma identidade global no sistema. A mesma resposta para
        // qualquer colisão evita revelar em qual instituição ele já existe.
        if (isUniqueViolation(error)) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'Não foi possível cadastrar este e-mail',
          });
        }
        throw error;
      }
    }),

  atualizar: adminProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        nome: z.string().min(3).optional(),
        role: z.enum(['admin', 'profissional', 'usuario']).optional(),
        cargoId: z.string().uuid().nullable().optional(),
        especialidade: z.enum(ESPECIALIDADES).optional(),
        registroProfissional: z.string().optional(),
        ativo: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;

      // T-47: admin não altera o próprio papel (evita auto-rebaixamento acidental).
      if (id === ctx.userId && data.role !== undefined) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Você não pode alterar o próprio papel',
        });
      }

      // Previne que o admin desative a si mesmo (trava instituição sem gestor)
      if (id === ctx.userId && data.ativo === false) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Você não pode desativar a própria conta',
        });
      }

      // T-47: troca de papel ou desativação do último admin ativo trava a instituição.
      if (data.role !== undefined || data.ativo === false) {
        await garantirNaoUltimoAdmin(ctx.db, ctx.instituicaoId, id);
      }

      // Cargo de outra instituição/inativo nunca é atribuído (multi-tenant).
      await validarCargoDaInstituicao(ctx.db, ctx.instituicaoId, data.cargoId);

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
          role: usuarios.role,
          especialidade: usuarios.especialidade,
          ativo: usuarios.ativo,
        });

      if (!usuario) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Usuário não encontrado',
        });
      }

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

      // T-47: desativar o último admin ativo trava a instituição.
      await garantirNaoUltimoAdmin(ctx.db, ctx.instituicaoId, input.id);

      const [usuario] = await ctx.db
        .update(usuarios)
        .set({ ativo: false })
        .where(
          and(
            eq(usuarios.id, input.id),
            eq(usuarios.instituicaoId, ctx.instituicaoId)
          )
        )
        .returning({ id: usuarios.id });

      if (!usuario) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Usuário não encontrado',
        });
      }

      return { success: true };
    }),

  // Perfil próprio — qualquer papel pode ver/editar apenas os próprios dados básicos
  meuPerfil: protectedProcedure.query(async ({ ctx }) => {
    // React Query rejeita `undefined`; findFirst sem match vira null.
    const perfil = await ctx.db.query.usuarios.findFirst({
      where: eq(usuarios.id, ctx.userId),
      columns: {
        id: true,
        nome: true,
        email: true,
        especialidade: true,
        registroProfissional: true,
        role: true,
        image: true,
      },
    });

    return perfil
      ? { ...perfil, permissoes: ctx.permissoes }
      : null;
  }),

  atualizarMeuPerfil: protectedProcedure
    .input(
      z.object({
        nome: z.string().min(3).optional(),
        registroProfissional: z.string().optional(),
        image: urlHttpSchema.optional().nullable(),
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
          image: usuarios.image,
        });
      return usuario;
    }),
});
