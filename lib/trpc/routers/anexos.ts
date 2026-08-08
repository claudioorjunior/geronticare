import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import {
  createTRPCRouter,
  readClinicalProcedure,
  exigirPermissao,
} from '../server';
import { anexos, registros } from '@/lib/db/schema';
import { verificarOwnershipPaciente } from '../ownership';
import { storageConfigurado } from '@/lib/storage';

const TAMANHO_MAXIMO = 50 * 1024 * 1024;

export const anexosRouter = createTRPCRouter({
  /**
   * Estado do storage + permissões do usuário — usado pela UI para exibir o
   * botão de upload conforme `anexo:criar`.
   */
  status: readClinicalProcedure.query(({ ctx }) => ({
    configurado: storageConfigurado(),
    podeCriar: ctx.permissoes.includes('anexo:criar'),
    podeDeletar: ctx.permissoes.includes('anexo:deletar'),
  })),

  /**
   * Cria um anexo avulso (sem vínculo com registro) direto da aba Documentos.
   * O arquivo já foi enviado ao storage via upload-url/upload-local; aqui só
   * persistem os metadados, com a chave validada contra tenant/paciente.
   */
  criar: exigirPermissao('anexo:criar')
    .input(
      z.object({
        pacienteId: z.string().uuid(),
        chave: z.string().min(1).max(1024),
        nome: z.string().min(1).max(255),
        tipo: z.string().min(1).max(255),
        tamanhoBytes: z.number().int().positive().max(TAMANHO_MAXIMO),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await verificarOwnershipPaciente(ctx.db, input.pacienteId, ctx.instituicaoId);

      const { extrairContextoChaveAnexo } = await import('@/lib/storage/s3');
      const contexto = extrairContextoChaveAnexo(input.chave);
      if (
        !contexto ||
        contexto.instituicaoId !== ctx.instituicaoId ||
        contexto.pacienteId !== input.pacienteId
      ) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Chave de anexo inválida para este paciente',
        });
      }

      // ADR 0001: mutations devolvem só `{ id }` — nunca ecoam a linha.
      const [novo] = await ctx.db
        .insert(anexos)
        .values({
          instituicaoId: ctx.instituicaoId,
          pacienteId: input.pacienteId,
          criadoPorId: ctx.userId,
          chave: input.chave,
          nome: input.nome,
          tipo: input.tipo,
          tamanhoBytes: input.tamanhoBytes,
        })
        .returning({ id: anexos.id });

      return { id: novo.id };
    }),

  /** Lista os metadados de anexos de um paciente (sem conteúdo). */
  listarPorPaciente: readClinicalProcedure
    .input(z.object({ pacienteId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await verificarOwnershipPaciente(ctx.db, input.pacienteId, ctx.instituicaoId);

      const lista = await ctx.db.query.anexos.findMany({
        where: and(
          eq(anexos.pacienteId, input.pacienteId),
          eq(anexos.instituicaoId, ctx.instituicaoId),
        ),
        orderBy: (anexos, { desc }) => [desc(anexos.createdAt)],
        columns: {
          id: true,
          chave: true,
          nome: true,
          tipo: true,
          tamanhoBytes: true,
          createdAt: true,
          registroId: true,
          criadoPorId: true,
        },
        with: {
          criadoPor: { columns: { nome: true } },
        },
      });

      return lista.map((anexo) => ({
        ...anexo,
        criadoPorNome: anexo.criadoPor?.nome ?? null,
      }));
    }),

  /**
   * Remove um anexo (metadados + objeto no storage).
   * Exige `anexo:deletar` e ownership do paciente do registro.
   */
  remover: exigirPermissao('anexo:deletar')
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const anexo = await ctx.db.query.anexos.findFirst({
        where: and(eq(anexos.id, input.id), eq(anexos.instituicaoId, ctx.instituicaoId)),
      });

      if (!anexo) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Anexo não encontrado' });
      }

      await verificarOwnershipPaciente(ctx.db, anexo.pacienteId, ctx.instituicaoId);

      // Anexo vinculado a registro: o registro precisa existir (ownership já
      // cobre o tenant via paciente). Anexo avulso não tem registro.
      if (anexo.registroId) {
        const registro = await ctx.db.query.registros.findFirst({
          where: eq(registros.id, anexo.registroId),
          columns: { id: true },
        });
        if (!registro) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Registro do anexo não encontrado' });
        }
      }

      await ctx.db.delete(anexos).where(eq(anexos.id, anexo.id));

      // Remoção do objeto no storage é best-effort: metadados já foram removidos;
      // objeto órfão é limpo pelo job de limpeza se esta falhar.
      const { driverAtivo } = await import('@/lib/storage');
      const driver = driverAtivo();
      if (driver === 'local') {
        const { removerAnexoLocal } = await import('@/lib/storage/local');
        await removerAnexoLocal(anexo.chave).catch(() => {});
      } else if (driver === 's3') {
        const { removerAnexo } = await import('@/lib/storage/s3');
        await removerAnexo(anexo.chave).catch(() => {});
      }

      return { removido: true };
    }),
});
