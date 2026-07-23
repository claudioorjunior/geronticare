# PRD — GerontiCare (Prontuário Eletrônico Geriátrico)

**Status:** Rascunho para discussão · v0.1
**Idioma:** pt-BR
**Escopo:** MVP open-source + roadmap até v1.0

---

## 1. Problem Statement

Profissionais e instituições que cuidam de pessoas idosas (ILPIs, clínicas de longa permanência, programas de home care geriátrico) hoje registram o atendimento em papel, planilhas soltas ou sistemas genéricos de prontuário eletrônico que não foram pensados para a complexidade do cuidado geriátrico.

Isso gera problemas concretos:

- **Perda de informação clínica** entre turnos e especialidades (medicina, enfermagem, fisioterapia, fono, nutrição, TO, psicologia, serviço social).
- **Avaliação geriátrica ampla (AGA) aplicada de forma inconsistente** — escalas como Katz, Lawton, MEEM, GDS-15, MAN e TUG raramente são aplicadas com periodicidade, registradas de forma estruturada ou comparadas ao longo do tempo.
- **Risco clínico elevado** por falta de histórico de sinais vitais, alergias, medicação e eventos adversos.
- **Custo alto de implantação** — prontuários comerciais são caros e voltados a hospitais agudos.
- **Multitenancy inexistente em soluções leves** — instituições pequenas não conseguem isolar dados de diferentes unidades com baixo custo.

O resultado é um cuidado fragmentado, sem rastreabilidade, com baixa qualidade de decisão clínica e baixa eficiência operacional.

## 2. Solution

GerontiCare é um **prontuário eletrônico open-source, multi-tenant, especializado em cuidado geriátrico**, construído para a realidade brasileira de ILPIs e clínicas de longa permanência. Entrega, desde o MVP, o que o mercado não entrega: prontuário multiprofissional, AGA estruturada, sinais vitais com série temporal e linha do tempo clínica — tudo com baixo custo de implantação e dados isolados por instituição.

Diferencial técnico:

- Open-source MIT — instituições podem hospedar, auditar e customizar.
- Multi-tenant desde a base do schema (`instituicaoId` em toda tabela de domínio).
- Foco no fluxo geriátrico: AGA, escalas validadas, prontuário por especialidade, timeline clínica.
- Stack moderna e barata de operar (Next.js serverless + Postgres gerenciado).

## 3. Goals & Non-Goals

### Goals (v1.0)

- Prontuário multiprofissional funcional com pelo menos 4 especialidades registrando.
- AGA completa com as 6 escalas gerando relatório consolidado.
- Sinais vitais com série temporal e alertas básicos.
- Multi-tenant com isolamento real por instituição.
- Autenticação e RBAC por especialidade/perfil.

### Non-Goals (v1.0)

- Prescrição eletrônica com integração a farmácias.
- Telemedicina síncrona (vídeo).
- Integração com sistemas públicos (RNDS, DATASUS).
- Mobile nativo (apenas web responsiva).
- Billing / faturamento TISS.

## 4. Personas

1. **Enfermeiro(a) de ILPI** — registra evolução diária, sinais vitais, intercorrências. Persona mais ativa do sistema.
2. **Médico(a) geriatra** — aplica AGA, prescreve, vê timeline clínica completa.
3. **Fisioterapeuta / TO / Fonoaudiólogo(a) / Nutricionista / Psicólogo(a) / Assistente Social** — registram evolução da sua área, veem histórico cruzado.
4. **Coordenador(a) / Administrador(a) da instituição** — gerencia usuários, vê relatórios operacionais, cadastra pacientes.
5. **Cuidador (read-only, futuro)** — visualiza informações do residente sob sua responsabilidade.

## 5. User Stories

### 5.1 Autenticação e Instituição

1. Como administrador da instituição, quero cadastrar minha ILPI com CNPJ e endereço, para começar a usar o sistema.
2. Como administrador, quero convidar profissionais por e-mail, para que eles criem conta na minha instituição.
3. Como profissional, quero fazer login com e-mail e senha, para acessar prontuários da minha instituição.
4. Como profissional, quero ver apenas dados da minha instituição, para garantir sigilo.
5. Como administrador, quero desativar um profissional, para revogar acesso sem excluir histórico.
6. Como administrador, quero definir o perfil/especialidade de cada usuário, para controlar permissões.

### 5.2 Cadastro de Pacientes

7. Como profissional, quero cadastrar um paciente com dados demográficos completos, para iniciar o prontuário.
8. Como profissional, quero buscar pacientes por nome, CPF ou data de nascimento, para localizar rapidamente.
9. Como profissional, quero ver lista de pacientes ativos da minha instituição, ordenada por admissão.
10. Como profissional, quero editar dados demográficos e de contato de emergência, para manter cadastro atualizado.
11. Como profissional, quero desativar um paciente (não excluir), para preservar histórico clínico.
12. Como profissional, quero registrar foto do paciente, para identificação visual em equipe.

### 5.3 Avaliação Geriátrica Ampla (AGA)

13. Como médico, quero aplicar a escala de Katz (AVD), para avaliar independência funcional.
14. Como médico, quero aplicar a escala de Lawton (AIVD), para avaliar atividades instrumentais.
15. Como médico, quero aplicar o MEEM (Mini-Exame do Estado Mental), para rastrear cognição.
16. Como médico, quero aplicar o GDS-15, para rastrear depressão.
17. Como nutricionista, quero aplicar a MAN (Mini Avaliação Nutricional), para rastrear desnutrição.
18. Como fisioterapeuta, quero aplicar o TUG (Timed Up and Go), para avaliar risco de queda.
19. Como médico, quero ver o relatório consolidado da AGA com interpretação automática das escalas, para acelerar a conduta.
20. Como médico, quero comparar AGA atual com anterior, para avaliar progressão.
21. Como profissional, quero ver histórico de todas as AGAs do paciente em timeline, para entender evolução funcional.

### 5.4 Prontuário Multiprofissional

22. Como profissional de qualquer especialidade, quero registrar evolução clínica estruturada, para contribuir com o prontuário.
23. Como profissional, quero ver timeline clínica unificada com filtros por especialidade e período, para entender o caso.
24. Como profissional, quero anexar arquivos (exames, fotos de lesão) ao registro, para enriquecer o prontuário.
25. Como médico, quero registrar alergias e medicamentos em uso, para referência rápida.
26. Como enfermeiro, quero registrar intercorrência crítica que dispare destaque na timeline, para comunicação visual.
27. Como profissional, quero editar/corrigir meu próprio registro, para corrigir erros.
28. Como coordenador, quero auditar quem registrou o quê e quando, para governança clínica.

### 5.5 Sinais Vitais

29. Como enfermeiro, quero registrar sinais vitais (PA, FC, FR, temperatura, SpO2, glicemia, peso), para monitoramento.
30. Como enfermeiro, quero registrar série de sinais ao longo do turno, para ver tendência intraday.
31. Como profissional, quero ver gráfico de série temporal de cada sinal vital, para detectar tendências.
32. Como profissional, quero receber alerta visual quando valor estiver fora da faixa de normalidade geriátrica, para ação rápida.
33. Como profissional, quero ver último registro de cada sinal vital no cabeçalho do paciente, para visão rápida.

### 5.6 Busca, Relatórios e Operação

34. Como coordenador, quero relatório de pacientes ativos por especialidade, para dimensionar equipe.
35. Como coordenador, quero relatório de AGAs aplicadas no mês, para controle de qualidade.
36. Como profissional, quero exportar prontuário em PDF, para compartilhamento pontual.
37. Como administrador, quero painel com contadores básicos (pacientes ativos, profissionais, registros no mês), para visão geral.
38. Como profissional, quero busca global por paciente, escala, registro ou sinal vital, para navegação rápida.

### 5.7 Auditoria, Segurança e Operação

39. Como administrador, quero logs de auditoria de ações sensíveis (acesso a prontuário, edição, exclusão lógica), para conformidade.
40. Como profissional, quero sessão com expiração automática, para reduzir risco de acesso indevido.
41. Como desenvolvedor da instituição, quero conseguir fazer backup do banco de dados, para DR.
42. Como administrador, quero poder exportar todos os dados da minha instituição, para portabilidade.

## 6. Functional Requirements

### 6.1 Domínio — já modelado no schema

- `instituicoes` — multi-tenant
- `usuarios` — profissionais com 8 especialidades (enum)
- `pacientes` — cadastro geriátrico completo com endereço e contato de emergência
- `avaliacoes_geriatricas` — AGA com 6 escalas numéricas
- `registros` — prontuário multiprofissional
- `sinais_vitais` — séries temporais com timestamp

### 6.2 Camadas técnicas existentes

- tRPC router raiz (`appRouter`) com `pacientes` (listar/buscar/criar).
- Drizzle client com `prepare: false` (compatível com Neon/Supabase transaction mode).
- Transformer `superjson` no tRPC (obrigatório em client e server).
- Providers React montando tRPC + TanStack Query.

### 6.3 Permissões (RBAC)

- `admin` — gerencia instituição, usuários, vê tudo.
- `profissional` — registra e consulta conforme especialidade.
- `leitura` — apenas consulta (futuro).

### 6.4 Validação

- Zod em todo input de procedure.
- Schemas reutilizáveis em `lib/validations/`.

## 7. Non-Functional Requirements

- **Performance**: páginas de listagem < 500ms p95 com até 1.000 pacientes por instituição.
- **Acessibilidade**: WCAG 2.1 AA mínimo (foco em profissionais mais velhos e pacientes com famílias leigas lendo relatórios).
- **Responsividade**: mobile-first, layout funcional em 360px.
- **Segurança**: senhas com hash (Better-Auth + bcrypt/argon2); todas as procedures filtram por `instituicaoId` do contexto; HTTPS obrigatório em produção.
- **LGPD**: dados sensíveis (CPF, prontuário) com base legal de execução de contrato; consentimento registrado; direito de portabilidade via export.
- **Observabilidade**: logs estruturados em rotas tRPC; erros reportados (Sentry opcional).
- **Idempotência**: mutações críticas idempotentes em rede de cliente.

## 8. Implementation Decisions

### Decisões já tomadas

- **D1 — Multi-tenant via `instituicaoId` em toda tabela.** Isolamento no nível de aplicação via contexto tRPC; sem RLS no MVP.
- **D2 — Auth via Better-Auth.** Reservado espaço em `lib/auth/`; `AUTH_SECRET` e `AUTH_URL` já previstos no `.env.local`.
- **D3 — tRPC v11 + superjson.** Datas e tipos complexos passam pelo transformer; nunca serializar manualmente.
- **D4 — Drizzle ORM com Postgres-js (`prepare: false`).** Compatível com Neon/Supabase transaction mode.
- **D5 — Zod 4 para validação de input.** Schemas reutilizáveis em `lib/validations/`.
- **D6 — Tailwind 4 + Geist font.** Já configurado no `app/layout.tsx` com `lang="pt-BR"`.
- **D7 — Path alias `@/*` → raiz.** Sem imports relativos profundos.
- **D8 — App Router + React 19.** Server components por padrão; `'use client'` só onde há hooks/eventos.
- **D9 — Migrations SQL gitignored** (`lib/db/migrations/*.sql`) exceto `.gitkeep`. Versionamento via `db:generate`.
- **D10 — MIT license.** Compatível com fork institucional.

### Decisões a tomar antes do MVP

- **D11 — Estratégia de deploy recomendada**: Vercel + Neon (free tier no MVP). Aceitar ou indicar alternativa institucional on-prem.
- **D12 — Idioma da UI**: pt-BR como padrão, sem i18n no MVP.
- **D13 — Modelo de especialidade**: enum fixo de 8 valores vs. tabela `especialidades` configurável. **Decisão pendente** — enum é mais simples e suficiente para o MVP.
- **D14 — Armazenamento de anexos**: S3-compatible vs. filesystem local. **Decisão pendente** — começar com S3-compatible (compatível com R2, MinIO).
- **D15 — RBAC**: hardcoded por enum de especialidade vs. matriz flexível por papel. **Decisão pendente** — começar com matriz simples: admin × especialidade × (ler/registrar).

## 9. Success Metrics

### MVP (3 meses)

- 5 instituições-piloto utilizando diariamente.
- ≥ 100 pacientes com AGA completa registrada.
- ≥ 1.000 registros de prontuário multiprofissional.
- Latência p95 < 500ms nas principais rotas.
- NPS de teste com 3 profissionais ≥ 40.

### v1.0 (6 meses)

- 20+ instituições.
- 4+ especialidades registrando ativamente.
- 95% dos pacientes ativos com pelo menos 1 AGA registrada.
- 0 incidentes de segurança multi-tenant (vazamento cruzado).

## 10. Risks & Mitigations

| Risco | Impacto | Mitigação |
|---|---|---|
| Vazamento multi-tenant por bug em query | Crítico | Testes E2E por institução; lint de revisão obrigatória em toda query |
| Resistência à adoção por profissionais mais velhos | Alto | UX com tipografia grande, atalhos, treinamentos gravados |
| LGPD / sigilo clínico | Alto | DPO desde o dia 1, política de dados documentada, consentimento explícito |
| Escopo inflado (telemed, prescrição) | Médio | Roadmap disciplinado, Non-Goals explícitos |
| Dependência de fornecedor de Postgres gerenciado | Médio | Documentar self-hosted PostgreSQL como alternativa |
| Custo de S3 para anexos | Baixo | Limite por instituição no MVP, cotas por plano futuro |

## 11. Open Questions

1. Onde fica o storage de anexos (R2, S3, MinIO)? **Pendente D14.**
2. Matriz RBAC será flexível ou hardcoded por especialidade? **Pendente D15.**
3. Família do paciente terá portal de leitura no MVP? **Sugerido: NÃO, fica para v1.1.**
4. Integração com RNDS (Ministério da Saúde) entra em qual fase? **Sugerido: v2.0+.**

## 12. References

- `SETUP_COMPLETO.txt` — decisões originais de schema e roadmap MVP.
- `AGENTS.md` — guia operacional do repositório para agentes de código.
- `lib/db/schema.ts` — fonte da verdade do domínio.
- `lib/trpc/routers/pacientes.ts` — exemplo de padrão de router a seguir.
