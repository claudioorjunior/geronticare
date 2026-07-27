import { z } from 'zod';

// ── Schemas de validação de paciente ──
// Espelham (mas não duplicam a lógica de) o input do tRPC router pacientes.criar/atualizar.
// O router continua sendo a fonte de verdade no servidor; isto valida no cliente
// para dar feedback imediato antes do round-trip e tipar o estado do formulário.

export const sexoOptions = ['masculino', 'feminino', 'outro'] as const;
export const estadoCivilOptions = [
  'solteiro',
  'casado',
  'viuvo',
  'divorciado',
  'uniao_estavel',
] as const;

const ufRegex = /^[A-Z]{2}$/;

const enderecoSchema = z.object({
  logradouro: z.string().min(3, 'Informe o logradouro'),
  numero: z.string().min(1, 'Informe o número'),
  complemento: z.string().max(100).optional(),
  bairro: z.string().min(2, 'Informe o bairro'),
  cidade: z.string().min(2, 'Informe a cidade'),
  estado: z.string().regex(ufRegex, 'UF com 2 letras (ex: SP)'),
  cep: z
    .string()
    .regex(/^\d{5}-?\d{3}$/, 'CEP no formato 00000-000'),
});

const contatoEmergenciaSchema = z.object({
  nome: z.string().min(3, 'Nome do contato é obrigatório'),
  parentesco: z.string().min(2, 'Informe o parentesco (ex: filho)'),
  telefone: z.string().min(8, 'Telefone inválido'),
});

// CPF: aceita formatado (000.000.000-00) ou só dígitos.
// Validação de check-digit é opcional e custosa — o servidor valida unicidade.
// Aqui garantimos apenas o formato para feedback imediato.
const cpfField = z
  .string()
  .trim()
  .optional()
  .refine((v) => !v || v === '' || /^\d{3}\.?\d{3}\.?\d{3}-?\d{2}$/.test(v), {
    message: 'CPF inválido (formato 000.000.000-00)',
  });

// ponytail: dia checado via algoritmo de validação de CPF fica para quando
// integrar com dados reais que exigem; hoje unicidade por instituição basta.
export const criarPacienteSchema = z.object({
  nome: z.string().trim().min(3, 'Nome completo (mínimo 3 letras)'),
  dataNascimento: z.string().min(1, 'Data de nascimento obrigatória'), // yyyy-mm-dd via <input type=date>
  cpf: cpfField,
  rg: z.string().max(30).optional(),
  sexo: z.enum(sexoOptions, { message: 'Selecione o sexo' }),
  estadoCivil: z.enum(estadoCivilOptions).optional(),
  telefone: z.string().max(20).optional(),
  email: z.string().email('E-mail inválido').optional().or(z.literal('')),
  dataAdmissao: z.string().min(1, 'Data de admissão obrigatória'),
  contatoEmergencia: contatoEmergenciaSchema.optional(),
  endereco: enderecoSchema.optional(),
});

export type CriarPacienteInput = z.infer<typeof criarPacienteSchema>;

// Campos editáveis pós-admissão (espelha pacientes.atualizar)
export const atualizarPacienteSchema = z.object({
  id: z.string().uuid(),
  nome: z.string().trim().min(3).optional(),
  cpf: cpfField,
  telefone: z.string().max(20).optional(),
  email: z.string().email().optional().or(z.literal('')),
  dataAdmissao: z.string().min(1).optional(),
  // contatoEmergencia não é partial: o router exige os 3 campos quando presente
  contatoEmergencia: contatoEmergenciaSchema.optional(),
  // endereco não é editável na aba Dados (sem UI para isso). Removido do payload.
  ativo: z.boolean().optional(),
});

export type AtualizarPacienteInput = z.infer<typeof atualizarPacienteSchema>;

// Mapeia códigos tRPC para mensagens user-friendly pt-BR
export function traduzirErroTRPC(code?: string, message?: string): string {
  switch (code) {
    case 'CONFLICT':
      return message ?? 'Já existe um paciente com este CPF nesta instituição';
    case 'UNAUTHORIZED':
      return 'Você precisa estar autenticado para salvar. (Protótipo: DB offline)';
    case 'FORBIDDEN':
      return message ?? 'Você não tem permissão para esta ação';
    case 'NOT_FOUND':
      return 'Paciente não encontrado';
    case 'BAD_REQUEST':
      return message ?? 'Dados inválidos — revise o formulário';
    default:
      return message ?? 'Falha ao salvar. Tente novamente.';
  }
}

// Converte ISO/Date para yyyy-mm-dd (valor esperado por <input type=date>)
export function toDateInput(v?: string | Date | null): string {
  if (!v) return '';
  const d = typeof v === 'string' ? new Date(v) : v;
  if (Number.isNaN(d.getTime())) return '';
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 10);
}

// Aplica máscara de CPF enquanto o usuário digita: 000.000.000-00
export function mascaraCPF(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 11);
  return d
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

// Aplica máscara de CEP: 00000-000
export function mascaraCEP(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 8);
  return d.replace(/(\d{5})(\d)/, '$1-$2');
}
