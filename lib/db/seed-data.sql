-- Seed data for mock dev database (PGLite)
-- Instituição mock
INSERT INTO instituicoes (id, nome, cnpj, telefone, email, created_at, updated_at)
VALUES (
  'ae6c72cc-c72e-4b20-9686-7d015efe9b24',
  'ILPI Modelo Mock',
  '00.000.000/0001-00',
  '(11) 99999-9999',
  'contato@ilpi-mock.com.br',
  '2025-01-01 00:00:00',
  '2025-01-01 00:00:00'
);

-- Usuário admin
INSERT INTO usuarios (id, instituicao_id, nome, email, role, ativo, created_at, updated_at)
VALUES (
  '320471aa-5994-4886-9ee6-1cee8e7aa810',
  'ae6c72cc-c72e-4b20-9686-7d015efe9b24',
  'Admin Mock',
  'admin@mock.ilpi',
  'admin',
  true,
  '2025-01-01 00:00:00',
  '2025-01-01 00:00:00'
);

-- Usuário leitura (papel usuario)
INSERT INTO usuarios (id, instituicao_id, nome, email, role, ativo, created_at, updated_at)
VALUES (
  'b8a2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
  'ae6c72cc-c72e-4b20-9686-7d015efe9b24',
  'Leitor Mock',
  'leitor@mock.ilpi',
  'usuario',
  true,
  '2025-01-01 00:00:00',
  '2025-01-01 00:00:00'
);

-- Usuário profissional
INSERT INTO usuarios (id, instituicao_id, nome, email, role, especialidade, registro_profissional, ativo, created_at, updated_at)
VALUES (
  'a49fa411-c9b2-48e5-98cf-a5f4fb1a9a23',
  'ae6c72cc-c72e-4b20-9686-7d015efe9b24',
  'Dr. Mock',
  'profissional@mock.ilpi',
  'profissional',
  'medicina',
  'CRM-SP 123456',
  true,
  '2025-01-01 00:00:00',
  '2025-01-01 00:00:00'
);

-- Equipe multiprofissional mock usada nos seletores de aplicação
INSERT INTO usuarios (id, instituicao_id, nome, email, role, especialidade, registro_profissional, ativo, created_at, updated_at)
VALUES
(
  '6fb4c4d5-1e9a-4f27-8c33-5e8b6a3d1f20',
  'ae6c72cc-c72e-4b20-9686-7d015efe9b24',
  'Nutri. Marina Alves',
  'nutricao@mock.ilpi',
  'profissional',
  'nutricao',
  'CRN-3 12345',
  true,
  '2025-01-01 00:00:00',
  '2025-01-01 00:00:00'
),
(
  '9d56ee72-6a18-46a9-9c27-01fb457ab4a8',
  'ae6c72cc-c72e-4b20-9686-7d015efe9b24',
  'Fisiot. Paulo Santos',
  'fisioterapia@mock.ilpi',
  'profissional',
  'fisioterapia',
  'CREFITO-3 123456-F',
  true,
  '2025-01-01 00:00:00',
  '2025-01-01 00:00:00'
),
(
  'b3a21970-3fbc-4dee-a6dc-51ff4ed6912d',
  'ae6c72cc-c72e-4b20-9686-7d015efe9b24',
  'Psic. Renata Costa',
  'psicologia@mock.ilpi',
  'profissional',
  'psicologia',
  'CRP 06/123456',
  true,
  '2025-01-01 00:00:00',
  '2025-01-01 00:00:00'
);

-- Sessão mock (token válido)
INSERT INTO sessions (id, user_id, token, expires_at, created_at, updated_at)
VALUES (
  '5a62b1b5-f24d-4002-b059-ada0efbcaa72',
  '320471aa-5994-4886-9ee6-1cee8e7aa810',
  'mock-session-token-dev',
  '2030-12-31 23:59:59',
  '2025-01-01 00:00:00',
  '2025-01-01 00:00:00'
);

-- Pacientes mock (v4 UUIDs válidos para Zod v4)
INSERT INTO pacientes (id, instituicao_id, nome, data_nascimento, cpf, rg, sexo, estado_civil, telefone, email, data_admissao, ativo, created_at, updated_at)
VALUES
(
  '7714cac2-1f53-4fd6-808d-0b87ea6bdf57',
  'ae6c72cc-c72e-4b20-9686-7d015efe9b24',
  'Maria Aparecida da Silva',
  '1940-03-15 00:00:00',
  '123.456.789-00',
  '12.345.678-9',
  'feminino',
  'viuvo',
  '(11) 91234-5678',
  'maria.silva@email.com.br',
  '2024-06-01 00:00:00',
  true,
  '2025-01-15 10:00:00',
  '2025-01-15 10:00:00'
),
(
  'ce5c328b-0e95-4136-b354-8a577d7cb2e7',
  'ae6c72cc-c72e-4b20-9686-7d015efe9b24',
  'João Batista de Oliveira',
  '1935-08-22 00:00:00',
  '987.654.321-00',
  '98.765.432-1',
  'masculino',
  'casado',
  '(11) 98765-4321',
  'joao.oliveira@email.com.br',
  '2024-03-10 00:00:00',
  true,
  '2025-01-10 09:00:00',
  '2025-01-10 09:00:00'
),
(
  'db345899-70b9-415c-8237-4cd236f4bd2e',
  'ae6c72cc-c72e-4b20-9686-7d015efe9b24',
  'Antônia Ferreira Costa',
  '1938-11-30 00:00:00',
  '456.789.123-00',
  '45.678.912-3',
  'feminino',
  'solteiro',
  '(11) 94567-8912',
  'antonia.costa@email.com.br',
  '2024-09-20 00:00:00',
  true,
  '2025-02-01 14:00:00',
  '2025-02-01 14:00:00'
),
(
  'ee9a940f-fa50-461f-a340-89b96e81fc39',
  'ae6c72cc-c72e-4b20-9686-7d015efe9b24',
  'Carlos Alberto Pereira',
  '1932-05-10 00:00:00',
  '789.123.456-00',
  '78.912.345-6',
  'masculino',
  'divorciado',
  '(11) 97891-2345',
  'carlos.pereira@email.com.br',
  '2023-12-05 00:00:00',
  true,
  '2024-12-05 08:00:00',
  '2024-12-05 08:00:00'
),
(
  '3a0cc5a0-68c2-42d3-869c-5f7f23ce2247',
  'ae6c72cc-c72e-4b20-9686-7d015efe9b24',
  'Dona Sebastiana Lima Santos',
  '1945-07-18 00:00:00',
  '321.654.987-00',
  '32.165.498-7',
  'feminino',
  'uniao_estavel',
  '(11) 93216-5498',
  'sebastiana.santos@email.com.br',
  '2025-01-08 00:00:00',
  false,
  '2025-03-01 11:00:00',
  '2025-03-01 11:00:00'
);
