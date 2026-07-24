# Inventário de Telas — GerontiCare (M4)

## Resumo do Schema
10 tabelas (instituicoes, usuarios, pacientes, avaliacoesGeriatricas, registros, sinaisVitais, anexos, sessions, accounts, verifications) + 3 enums (sexo, estado_civil, especialidade). Multi-tenant via `instituicaoId`.

## Estado tRPC (6 routers)
- instituicoes: buscar, atualizar (sem criar/listar completos — parcial)
- usuarios: listar, buscar, criar, atualizar, desativar (CRUD completo)
- pacientes: listar, buscar, criar, atualizar, buscarPorCpf (CRUD completo)
- avaliacoesGeriatricas: listar, buscar, criar, atualizar + auto-interpretação (CRUD completo)
- registros: listar, buscarPorPaciente, criar, atualizar (CRUD completo)
- sinaisVitais: listarPorPaciente, buscar, criar, atualizar, tendencias (CRUD completo + agregação)

Nenhuma tela de UI implementada; `page.tsx` é placeholder.

---

## Mapeamento de Telas

### 1. Login / Registro (Auth — Better-Auth)
- Campos: email, senha; registro: nome, email, senha, instituicaoId, especialidade (enum), registroProfissional
- Validações: Zod email/uuid, senha min 8, instituicaoId obrigatório, multi-tenant
- API: Better-Auth (sessions/accounts/verifications) — não tRPC; nativa
- Complexidade: média (form + redirecionamento, multi-tenant)

### 2. Dashboard (tela principal)
- Campos: cards (total pacientes, admissões do mês, avaliações pendentes), gráfico rápido de sinais vitais médios
- Validações: nenhuma (leitura agregada)
- API: NÃO EXISTE router de dashboard/agregações. Precisa ser criado.
- Complexidade: alta (cards + gráfico + subcomponentes)

### 3. Perfil / Configurações da Instituição
- Campos: nome, cnpj (único), telefone, email, endereco (jsonb: logradouro, numero, complemento, bairro, cidade, estado, cep)
- Validações: cnpj único, email válido, endereco obrigatório
- API: `instituicoes` — buscar, atualizar (falta criar/listar)
- Complexidade: média

### 4. Lista de Usuários (Profissionais)
- Campos: nome, email, especialidade (enum), registroProfissional, ativo (boolean)
- Validações: email único, especialidade obrigatória
- API: `usuarios` — listar, buscar, criar, atualizar, desativar (CRUD completo)
- Complexidade: simples (tabela com ações)

### 5. Formulário de Usuário
- Mesmo campos da lista + senha (Better-Auth gerencia)
- Validações: email único, registroProfissional obrigatório para medicina
- API: criar/atualizar existente; desativar (soft delete via `ativo`)
- Complexidade: média

### 6. Lista de Pacientes
- Campos: nome, cpf (único), dataNascimento, sexo (enum), estadoCivil (enum), telefone, ativo
- Validações: cpf único, dataNascimento obrigatória
- API: `pacientes` — listar, buscar, criar, atualizar, buscarPorCpf (CRUD completo)
- Complexidade: simples (tabela + busca por CPF)

### 7. Perfil do Paciente (tela unificada — alta complexidade)
- Campos principais: nome, cpf, rg, sexo, estadoCivil, dataNascimento, telefone, email, endereco, contatoEmergencia (jsonb: nome, parentesco, telefone), dataAdmissao, fotoUrl, ativo
- Subcomponentes:
  - A. Timeline unificada (`registros: buscarPorPaciente`) — evolução, prescrição, ocorrência, admissão, alta, transferência; com anexos
  - B. Avaliações Geriátricas (`avaliacoesGeriatricas`) — tabela de AGA (Katz, Lawton, MEEM, GDS-15, MNA, TUG) + auto-interpretação
  - C. Sinais Vitais (`sinaisVitais: listarPorPaciente, tendencias`) — tabela + gráfico de tendências (média por período)
  - D. Anexos (`anexos`) — upload/download
- Validações: cpf/rg únicos, dataAdmissao obrigatória, idade calculada automaticamente
- API: `pacientes` (base) + `registros` + `avaliacoesGeriatricas` + `sinaisVitais` + `anexos` — todos existentes; `anexos` NÃO tem router tRPC (falta criar)
- Complexidade: alta (formulário + 4 subcomponentes + timeline + gráficos)

### 8. Avaliação Geriátrica (formulário AGA)
- Campos: pacienteId, dataAvaliacao, tipo (enum: inicial/periodica/alta), resultados (jsonb: Katz 0-6, Lawton 0-8, MEEM 0-30, GDS-15 0-15, MNA, TUG segundos), interpretacao, observacoes, ativa
- Validações: tipo obrigatório, scores dentro dos intervalos, interpretação automática via `interpretarEscala`
- API: `avaliacoesGeriatricas` — listar, buscar, criar, atualizar + auto-interpretação (CRUD completo)
- Complexidade: alta (formulário complexo + validação de escalas + interpretação automática)

### 9. Registro Clínico (Prontuário)
- Campos: pacienteId, profissionalId, especialidade (enum), tipo (enum: evolucao/prescricao/ocorrencia/admissao/alta/transferencia), titulo, conteudo, dataRegistro, anexos (jsonb array)
- Validações: tipo obrigatório, conteudo min 10 chars
- API: `registros` — listar, buscarPorPaciente, criar, atualizar (CRUD completo)
- Complexidade: média (formulário com validação + anexos)

### 10. Sinais Vitais — Formulário
- Campos: pacienteId, dataHora, temperatura (décimos °C), frequenciaCardiaca, frequenciaRespiratoria, pressaoSistolica, pressaoDiastolica, saturacaoO2, glicemiaCapilar, peso (gramas), altura (cm), dor (enum 0-10), observacoes
- Validações: valores dentro de intervalos fisiológicos, temperatura em décimos, peso/altura positivos
- API: `sinaisVitais` — listarPorPaciente, buscar, criar, atualizar, tendencias (CRUD completo + agregação)
- Complexidade: média (formulário denso)

### 11. Sinais Vitais — Tendências / Gráfico
- Campos: médias por período de todos os sinais; agregação automática
- API: `tendencias` já existe; precisa de componente gráfico
- Complexidade: alta (gráfico + subcomponentes)

### 12. Anexos (Upload/Download)
- Campos: pacienteId, registroId (opcional), nome, tipo, tamanho, s3Key, s3Url
- Validações: tamanho máximo, tipo permitido
- API: NÃO EXISTE router tRPC para `anexos`. Precisa ser criado.
- Complexidade: média (upload S3 + tabela)

---

## Gaps Identificados para M4
1. Dashboard: criar router tRPC de agregações.
2. Anexos: criar router tRPC completo.
3. Instituicoes: completar criar/listar.
4. Nenhum componente shadcn/ui instalado — zero UI.
5. Tela de perfil de paciente precisa integrar 4 routers simultaneamente.
