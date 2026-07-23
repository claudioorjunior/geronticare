import { pgTable, text, timestamp, uuid, integer, boolean, jsonb, pgEnum } from 'drizzle-orm/pg-core';

// Enums
export const sexoEnum = pgEnum('sexo', ['masculino', 'feminino', 'outro']);
export const estadoCivilEnum = pgEnum('estado_civil', ['solteiro', 'casado', 'viuvo', 'divorciado', 'uniao_estavel']);
export const especialidadeEnum = pgEnum('especialidade', ['medicina', 'enfermagem', 'fisioterapia', 'terapia_ocupacional', 'fonoaudiologia', 'nutricao', 'psicologia', 'servico_social']);

// Tabela: Instituições (multi-tenant)
export const instituicoes = pgTable('instituicoes', {
  id: uuid('id').primaryKey().defaultRandom(),
  nome: text('nome').notNull(),
  cnpj: text('cnpj').unique(),
  telefone: text('telefone'),
  email: text('email'),
  endereco: jsonb('endereco').$type<{
    logradouro: string;
    numero: string;
    complemento?: string;
    bairro: string;
    cidade: string;
    estado: string;
    cep: string;
  }>(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Tabela: Usuários (profissionais)
// Better-Auth usa esta tabela como user. Campos senha, especialidade e instituicaoId
// são específicos do domínio e não mapeados pelo adapter.
export const usuarios = pgTable('usuarios', {
  id: uuid('id').primaryKey().defaultRandom(),
  instituicaoId: uuid('instituicao_id').references(() => instituicoes.id).notNull(),
  nome: text('nome').notNull(),
  email: text('email').unique().notNull(),
  senha: text('senha'), // usado apenas se migrar para auth própria; Better-Auth gerencia hash
  especialidade: especialidadeEnum('especialidade'),
  registroProfissional: text('registro_profissional'), // CRM, COREN, CREFITO, etc
  ativo: boolean('ativo').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Tabelas do Better-Auth
export const sessions = pgTable('sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => usuarios.id, { onDelete: 'cascade' }).notNull(),
  token: text('token').notNull().unique(),
  expiresAt: timestamp('expires_at').notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const accounts = pgTable('accounts', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => usuarios.id, { onDelete: 'cascade' }).notNull(),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at'),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const verifications = pgTable('verifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Tabela: Pacientes
export const pacientes = pgTable('pacientes', {
  id: uuid('id').primaryKey().defaultRandom(),
  instituicaoId: uuid('instituicao_id').references(() => instituicoes.id).notNull(),
  nome: text('nome').notNull(),
  dataNascimento: timestamp('data_nascimento').notNull(),
  cpf: text('cpf').unique(),
  rg: text('rg'),
  sexo: sexoEnum('sexo').notNull(),
  estadoCivil: estadoCivilEnum('estado_civil'),
  telefone: text('telefone'),
  email: text('email'),
  endereco: jsonb('endereco').$type<{
    logradouro: string;
    numero: string;
    complemento?: string;
    bairro: string;
    cidade: string;
    estado: string;
    cep: string;
  }>(),
  contatoEmergencia: jsonb('contato_emergencia').$type<{
    nome: string;
    parentesco: string;
    telefone: string;
  }>(),
  dataAdmissao: timestamp('data_admissao').notNull(),
  fotoUrl: text('foto_url'),
  ativo: boolean('ativo').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Tabela: Avaliação Geriátrica Ampla (AGA)
export const avaliacoesGeriatricas = pgTable('avaliacoes_geriatricas', {
  id: uuid('id').primaryKey().defaultRandom(),
  pacienteId: uuid('paciente_id').references(() => pacientes.id).notNull(),
  profissionalId: uuid('profissional_id').references(() => usuarios.id).notNull(),
  dataAvaliacao: timestamp('data_avaliacao').defaultNow().notNull(),
  
  // Escalas funcionais
  katzScore: integer('katz_score'), // 0-6 (independência em AVD)
  lawtonScore: integer('lawton_score'), // 0-8 (AIVD)
  meemScore: integer('meem_score'), // 0-30 (Mini-Exame do Estado Mental)
  gds15Score: integer('gds15_score'), // 0-15 (Escala de Depressão Geriátrica)
  manScore: integer('man_score'), // Mini Avaliação Nutricional
  tugSegundos: integer('tug_segundos'), // Timed Up and Go (segundos)
  
  // Comorbidades
  comorbidades: jsonb('comorbidades').$type<string[]>(),
  medicamentos: jsonb('medicamentos').$type<Array<{
    nome: string;
    dose: string;
    frequencia: string;
  }>>(),
  
  // Suporte social
  suporteSocial: text('suporte_social'),
  moradia: text('moradia'),
  
  // Observações
  observacoes: text('observacoes'),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Tabela: Prontuário (registros clínicos)
export const registros = pgTable('registros', {
  id: uuid('id').primaryKey().defaultRandom(),
  pacienteId: uuid('paciente_id').references(() => pacientes.id).notNull(),
  profissionalId: uuid('profissional_id').references(() => usuarios.id).notNull(),
  especialidade: especialidadeEnum('especialidade').notNull(),
  tipo: text('tipo').notNull(), // evolucao, prescricao, exame, intercorrencia
  titulo: text('titulo').notNull(),
  conteudo: text('conteudo').notNull(),
  dataRegistro: timestamp('data_registro').defaultNow().notNull(),
  anexos: jsonb('anexos').$type<Array<{
    nome: string;
    url: string;
    tipo: string;
  }>>(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Tabela: Sinais vitais
export const sinaisVitais = pgTable('sinais_vitais', {
  id: uuid('id').primaryKey().defaultRandom(),
  pacienteId: uuid('paciente_id').references(() => pacientes.id).notNull(),
  profissionalId: uuid('profissional_id').references(() => usuarios.id).notNull(),
  dataAfericao: timestamp('data_afericao').defaultNow().notNull(),
  pressaoArterialSistolica: integer('pressao_arterial_sistolica'),
  pressaoArterialDiastolica: integer('pressao_arterial_diastolica'),
  frequenciaCardiaca: integer('frequencia_cardiaca'),
  frequenciaRespiratoria: integer('frequencia_respiratoria'),
  temperatura: integer('temperatura'), // em décimos de °C (ex: 365 = 36.5°C)
  saturacaoO2: integer('saturacao_o2'),
  glicemia: integer('glicemia'),
  peso: integer('peso'), // em gramas
  altura: integer('altura'), // em centímetros
  observacoes: text('observacoes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export type Instituicao = typeof instituicoes.$inferSelect;
export type NovaInstituicao = typeof instituicoes.$inferInsert;
export type Usuario = typeof usuarios.$inferSelect;
export type NovoUsuario = typeof usuarios.$inferInsert;
export type Paciente = typeof pacientes.$inferSelect;
export type NovoPaciente = typeof pacientes.$inferInsert;
export type AvaliacaoGeriatrica = typeof avaliacoesGeriatricas.$inferSelect;
export type NovaAvaliacaoGeriatrica = typeof avaliacoesGeriatricas.$inferInsert;
export type Registro = typeof registros.$inferSelect;
export type NovoRegistro = typeof registros.$inferInsert;
export type SinaisVitais = typeof sinaisVitais.$inferSelect;
export type NovosSinaisVitais = typeof sinaisVitais.$inferInsert;
