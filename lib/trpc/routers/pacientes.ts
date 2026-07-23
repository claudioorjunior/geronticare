import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '../server';
import { pacientes } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

export const pacientesRouter = createTRPCRouter({
  listar: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.query.pacientes.findMany({
      where: and(
        eq(pacientes.ativo, true),
        eq(pacientes.instituicaoId, ctx.instituicaoId)
      ),
      orderBy: (pacientes, { desc }) => [desc(pacientes.createdAt)],
    });
  }),

  buscar: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.query.pacientes.findFirst({
        where: and(
          eq(pacientes.id, input.id),
          eq(pacientes.instituicaoId, ctx.instituicaoId)
        ),
      });
    }),

  criar: protectedProcedure
    .input(
      z.object({
        nome: z.string().min(3),
        dataNascimento: z.coerce.date(),
        cpf: z.string().optional(),
        rg: z.string().optional(),
        sexo: z.enum(['masculino', 'feminino', 'outro']),
        estadoCivil: z.enum(['solteiro', 'casado', 'viuvo', 'divorciado', 'uniao_estavel']).optional(),
        telefone: z.string().optional(),
        email: z.string().email().optional(),
        dataAdmissao: z.coerce.date(),
        contatoEmergencia: z.object({
          nome: z.string(),
          parentesco: z.string(),
          telefone: z.string(),
        }).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Valida unicidade de CPF se fornecido
      if (input.cpf) {
        const cpfExistente = await ctx.db.query.pacientes.findFirst({
          where: eq(pacientes.cpf, input.cpf),
          columns: { id: true },
        });
        if (cpfExistente) {
          throw new Error('Já existe um paciente cadastrado com este CPF');
        }
      }

      const [novoPaciente] = await ctx.db
        .insert(pacientes)
        .values({
          ...input,
          instituicaoId: ctx.instituicaoId,
        })
        .returning();
      return novoPaciente;
    }),

  atualizar: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        nome: z.string().min(3).optional(),
        telefone: z.string().optional(),
        email: z.string().email().optional(),
        dataAdmissao: z.coerce.date().optional(),
        contatoEmergencia: z.object({
          nome: z.string(),
          parentesco: z.string(),
          telefone: z.string(),
        }).optional(),
        ativo: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const [pacienteAtualizado] = await ctx.db
        .update(pacientes)
        .set(data)
        .where(
          and(
            eq(pacientes.id, id),
            eq(pacientes.instituicaoId, ctx.instituicaoId)
          )
        )
        .returning();
      return pacienteAtualizado;
    }),

  desativar: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(pacientes)
        .set({ ativo: false })
        .where(
          and(
            eq(pacientes.id, input.id),
            eq(pacientes.instituicaoId, ctx.instituicaoId)
          )
        );
      return { success: true };
    }),
});
