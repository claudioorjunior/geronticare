import { TRPCError } from '@trpc/server';
import { and, asc, desc, eq, isNotNull, or } from 'drizzle-orm';
import { z } from 'zod';
import { aplicacoesInstrumentos, usuarios } from '@/lib/db/schema';
import {
  aplicacaoInstrumentoInputSchema,
  parseAplicacaoInstrumentoInput,
} from '@/lib/instrumentos/aplicacao';
import { INSTRUMENTO_SLUGS } from '@/lib/instrumentos/instrumentos';
import { verificarOwnershipPaciente } from '../ownership';
import {
  clinicalProcedure,
  createTRPCRouter,
  readClinicalProcedure,
} from '../server';

const PROFISSIONAL_INVALIDO =
  'Selecione um profissional ativo da sua instituição.';

const escopoPacienteSchema = z.strictObject({
  pacienteId: z.string().uuid(),
});

const escopoInstrumentoSchema = escopoPacienteSchema.extend({
  instrumento: z.enum(INSTRUMENTO_SLUGS),
});

export const aplicacoesInstrumentosRouter = createTRPCRouter({
  resumoCatalogo: readClinicalProcedure
    .input(escopoPacienteSchema)
    .query(async ({ ctx, input }) => {
      await verificarOwnershipPaciente(
        ctx.db,
        input.pacienteId,
        ctx.instituicaoId,
      );

      return ctx.db
        .selectDistinctOn([aplicacoesInstrumentos.instrumento], {
          id: aplicacoesInstrumentos.id,
          instrumento: aplicacoesInstrumentos.instrumento,
          dataAplicacao: aplicacoesInstrumentos.dataAplicacao,
          escore: aplicacoesInstrumentos.escore,
          classificacao: aplicacoesInstrumentos.classificacao,
          descricaoClassificacao: aplicacoesInstrumentos.descricaoClassificacao,
          versaoInstrumento: aplicacoesInstrumentos.versaoInstrumento,
          createdAt: aplicacoesInstrumentos.createdAt,
          profissional: {
            id: usuarios.id,
            nome: usuarios.nome,
            especialidade: usuarios.especialidade,
            registroProfissional: usuarios.registroProfissional,
          },
        })
        .from(aplicacoesInstrumentos)
        .innerJoin(
          usuarios,
          eq(aplicacoesInstrumentos.profissionalId, usuarios.id),
        )
        .where(eq(aplicacoesInstrumentos.pacienteId, input.pacienteId))
        .orderBy(
          asc(aplicacoesInstrumentos.instrumento),
          desc(aplicacoesInstrumentos.dataAplicacao),
          desc(aplicacoesInstrumentos.createdAt),
          desc(aplicacoesInstrumentos.id),
        );
    }),

  listar: readClinicalProcedure
    .input(escopoInstrumentoSchema)
    .query(async ({ ctx, input }) => {
      await verificarOwnershipPaciente(
        ctx.db,
        input.pacienteId,
        ctx.instituicaoId,
      );

      return ctx.db.query.aplicacoesInstrumentos.findMany({
        where: and(
          eq(aplicacoesInstrumentos.pacienteId, input.pacienteId),
          eq(aplicacoesInstrumentos.instrumento, input.instrumento),
        ),
        orderBy: (aplicacoesInstrumentos, { desc }) => [
          desc(aplicacoesInstrumentos.dataAplicacao),
          desc(aplicacoesInstrumentos.createdAt),
        ],
        columns: {
          id: true,
          dataAplicacao: true,
          escore: true,
          classificacao: true,
          descricaoClassificacao: true,
          versaoInstrumento: true,
          createdAt: true,
        },
        with: {
          profissional: {
            columns: {
              id: true,
              nome: true,
              especialidade: true,
              registroProfissional: true,
            },
          },
        },
      });
    }),

  buscar: readClinicalProcedure
    .input(
      z.strictObject({
        id: z.string().uuid(),
        pacienteId: z.string().uuid(),
        instrumento: z.enum(INSTRUMENTO_SLUGS),
      }),
    )
    .query(async ({ ctx, input }) => {
      await verificarOwnershipPaciente(
        ctx.db,
        input.pacienteId,
        ctx.instituicaoId,
      );

      // React Query rejeita `undefined`; findFirst sem match vira null.
      return (await ctx.db.query.aplicacoesInstrumentos.findFirst({
        where: and(
          eq(aplicacoesInstrumentos.id, input.id),
          eq(aplicacoesInstrumentos.pacienteId, input.pacienteId),
          eq(aplicacoesInstrumentos.instrumento, input.instrumento),
        ),
        columns: {
          id: true,
          pacienteId: true,
          instrumento: true,
          dataAplicacao: true,
          respostas: true,
          escore: true,
          classificacao: true,
          descricaoClassificacao: true,
          versaoInstrumento: true,
          createdAt: true,
        },
        with: {
          profissional: {
            columns: {
              id: true,
              nome: true,
              especialidade: true,
              registroProfissional: true,
            },
          },
          registradoPor: {
            columns: {
              id: true,
              nome: true,
            },
          },
        },
      })) ?? null;
    }),

  criar: clinicalProcedure
    .input(aplicacaoInstrumentoInputSchema)
    .mutation(async ({ ctx, input }) => {
      await verificarOwnershipPaciente(
        ctx.db,
        input.pacienteId,
        ctx.instituicaoId,
      );

      const profissional = await ctx.db.query.usuarios.findFirst({
        where: and(
          eq(usuarios.id, input.profissionalId),
          eq(usuarios.instituicaoId, ctx.instituicaoId),
          eq(usuarios.ativo, true),
          or(eq(usuarios.role, 'admin'), eq(usuarios.role, 'profissional')),
          isNotNull(usuarios.especialidade),
        ),
        columns: {
          id: true,
          instituicaoId: true,
          especialidade: true,
          role: true,
          ativo: true,
        },
      });

      if (
        !profissional ||
        !profissional.ativo ||
        profissional.instituicaoId !== ctx.instituicaoId ||
        !profissional.especialidade ||
        (profissional.role !== 'admin' && profissional.role !== 'profissional')
      ) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: PROFISSIONAL_INVALIDO,
        });
      }

      let aplicacao: ReturnType<typeof parseAplicacaoInstrumentoInput>;
      try {
        aplicacao = parseAplicacaoInstrumentoInput(input);
      } catch (error) {
        const message =
          error instanceof z.ZodError
            ? (error.issues[0]?.message ?? 'Revise as respostas do instrumento.')
            : error instanceof Error
              ? error.message
              : 'Revise os dados da aplicação.';

        throw new TRPCError({
          code: 'BAD_REQUEST',
          message,
          cause: error,
        });
      }

      const [novaAplicacao] = await ctx.db
        .insert(aplicacoesInstrumentos)
        .values({
          pacienteId: aplicacao.pacienteId,
          instrumento: aplicacao.instrumento,
          profissionalId: aplicacao.profissionalId,
          registradoPorId: ctx.userId,
          dataAplicacao: aplicacao.dataAplicacao,
          respostas: aplicacao.respostas,
          escore: aplicacao.resultado.escore,
          classificacao: aplicacao.resultado.classificacao,
          descricaoClassificacao: aplicacao.resultado.descricao,
          versaoInstrumento: aplicacao.versaoInstrumento,
        })
        .returning({ id: aplicacoesInstrumentos.id });

      return novaAplicacao;
    }),
});
