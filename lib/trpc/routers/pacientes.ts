import { z } from 'zod';
import { createTRPCRouter, protectedProcedure, adminProcedure } from '../server';
import { pacientes } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { verificarOwnershipPaciente } from '../ownership';

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
      const patient = await ctx.db.query.pacientes.findFirst({
        where: and(
          eq(pacientes.id, input.id),
          eq(pacientes.instituicaoId, ctx.instituicaoId),
        ),
      });
      if (!patient) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Paciente não encontrado',
        });
      }
      return patient;
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
      // Valida unicidade de CPF dentro da instituição (não vaza existência em outras ILPIs)
      if (input.cpf) {
        const cpfExistente = await ctx.db.query.pacientes.findFirst({
          where: and(
            eq(pacientes.cpf, input.cpf),
            eq(pacientes.instituicaoId, ctx.instituicaoId)
          ),
          columns: { id: true },
        });
        if (cpfExistente) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'Já existe um paciente cadastrado com este CPF',
          });
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
        cpf: z.string().optional(),
        telefone: z.string().optional(),
        email: z.string().email().optional(),
        dataAdmissao: z.coerce.date().optional(),
        contatoEmergencia: z.object({
          nome: z.string(),
          parentesco: z.string(),
          telefone: z.string(),
        }).optional(),
        ativo: z.boolean().optional(),
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
      const { id, ...data } = input;

      // Verifica que o paciente existe e pertence à instituição
      await verificarOwnershipPaciente(ctx.db, id, ctx.instituicaoId);

      // Valida unicidade de CPF (mesmo padrão de pacientes.criar)
      if (data.cpf) {
        const cpfExistente = await ctx.db.query.pacientes.findFirst({
          where: and(
            eq(pacientes.cpf, data.cpf),
            eq(pacientes.instituicaoId, ctx.instituicaoId),
          ),
          columns: { id: true },
        });
        if (cpfExistente && cpfExistente.id !== id) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'Já existe um paciente cadastrado com este CPF',
          });
        }
      }

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

  desativar: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await verificarOwnershipPaciente(ctx.db, input.id, ctx.instituicaoId);
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
