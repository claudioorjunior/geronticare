# Changelog

Todos os mudanças notáveis deste projeto serão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/),
e este projeto adere ao [Versionamento Semântico](https://semver.org/lang/pt-BR/).

## [0.5.5] - 2026-08-08

### Adicionado

- **CLI self-hosted installer (v0.5.0)**
  - Instala o GerontiCare em modo gerenciado: PostgreSQL local automático ou provedor cloud (Neon/Supabase)
  - Comandos `start`, `stop`, `status`, `upgrade`, `rollback` e `doctor`
  - Servidor detached com PID tracking e lock de instalação

- **Upgrade/rollback com downtime mínimo**
  - Backup + preparo do release com servidor ainda no ar; cutover de ~2–3s
  - Validação de porta ocupada por TCP (não apenas `/api/health`) antes de upgrade/rollback
  - Validação de secrets/config antes de parar o servidor no rollback
  - Restauração única da versão anterior em falha de cutover (CLI e admin runner)
  - Bookkeeping pós-cutover fora do catch de rollback (falha de persistência não reverte servidor saudável)
  - Rollback permitido quando o servidor já está parado

- **Admin update & version awareness (v0.5.5)**
  - Página admin de atualização com runner em background (`scripts/upgrade-runner.mjs`)
  - Notificação de versão disponível no CLI (doctor/start) e no app (admin)

### Corrigido

- CLI version alinhada a 0.5.5 (release tag check)
- Teste CLI no Windows: normalização de path separators (`GERONTICARE_HOME`)
- Rollback não deixava o servidor offline quando secrets inválidos

## [0.3.0] - 2026-08-05

### Adicionado

- **Perfil de usuário**
  - Página de perfil com avatar, nome e troca de senha
  - Card de usuário com dropdown (Meu Perfil / Deslogar)
  - Validação de upload de avatar (GIF bloqueado)

- **AGA completa (Avaliação Geriátrica Ampla)**
  - Lista de AGAs + formulário interativo com scoring em tempo real
  - Classificação RDC 502/2021 e resumo clínico na página do paciente
  - Relatórios imprimíveis e comparação automática entre avaliações
  - TUG alinhado a segundos (antes ordinal 0-9)

- **RBAC**
  - Papéis persistidos no banco controlam acesso a pacientes
  - Papel `usuario` ganha acesso de leitura a dados clínicos

- **AGA consolidada pela equipe (modelo novo)**
  - Cada profissional preenche seus instrumentos em Avaliações; a página da AGA consolida as aplicações concluídas
  - Timeline de evolução da AGA + relatório imprimível da consolidação
  - Grau de dependência RDC 502/2021 **derivado de Katz + MEEM** e confirmado pelo profissional na conclusão (justificativa obrigatória ao divergir)

- **Ficha do residente**
  - 5 KPIs de sinais vitais (Temperatura adicionada)
  - Atalhos para AGA, Avaliações, Registros e Sinais Vitais
  - Resumo da última AGA concluída

- **RBAC na ficha**: papel `usuario` vê dados clínicos sem editar; campos clínicos e contato de emergência desabilitados

- **Suíte de testes**: 108 testes, incluindo integração ponta a ponta com banco real (migrations + FKs + seed via PGlite)

### Alterado

- Legado `avaliacoesGeriatricas` agora é **somente leitura** (dados antigos preservados; escritas só pelo modelo novo)
- Ambiente de desenvolvimento usa **Postgres real** quando `DATABASE_URL` está definida; PGlite in-memory apenas como fallback para testes/CI
- CI e release alinhados para Node 22

### Segurança

- Escores da AGA calculados exclusivamente no servidor (cliente não envia escores)
- DTOs mínimos: queries com colunas explícitas, mutations devolvem apenas `{ id }`
- `Cache-Control: private, no-store` em todas as respostas de `/api/auth/*` e `/api/trpc/*`
- Logout limpa o cache do React Query (estado clínico não persiste no navegador)
- Contexto tRPC exige `usuario.ativo` (fail-closed, inclusive no dev bypass)
- `DEV_AUTH_BYPASS` explícito e desabilitado em produção
- Decisão documentada em `docs/decisions/0001-protecao-dados-clinicos.md`

### Corrigido

- Formatação de datas timezone-safe na AGA
- Migrations unificadas em uma única `0000_curious_naoko` + loader dinâmico
- Guard para dados `undefined` em `buscar` e páginas de paciente

## [0.2.0] - 2026-07-24

### Adicionado

- **M3/M4: Interface do prontuário**
  - Dashboard com design tokens + TopNav persistente
  - Navegação híbrida TopNav + tabs no prontuário do paciente
  - Formulário editável de dados do paciente com controle por papel
  - Lista de pacientes com status
  - Formulário completo de AGA com 6 escalas + interpretação automática
  - Sinais vitais com formulário + gráfico Recharts
  - Timeline clínica unificada com 5 tipos de registro
  - shadcn/ui inicializado + role switcher para desenvolvimento

- **Papéis de usuário**
  - Enum `role` (admin/profissional/usuario) + `adminProcedure`

### Segurança

- Auditoria: correção de vazamentos cross-tenant, path traversal no S3, validação de input
- Brechas de autorização fechadas em routers tRPC + guards

## [0.1.0] - 2026-07-23

### Adicionado

- **M0: Fundação do projeto**
  - Repositório GitHub com CI (lint, type-check, build)
  - Branch protection em `main` (PR obrigatório, 1 review, linear history)
  - Documentação bilíngue: README, CONTRIBUTING, CODE_OF_CONDUCT, SECURITY
  - Templates de issue (bug report, feature request)

- **M1: Autenticação e multi-tenancy**
  - Better-Auth com adapter Drizzle (email/senha)
  - Tabelas `sessions`, `accounts`, `verifications` no schema
  - Contexto tRPC com `instituicaoId` automático
  - Routers: `instituicoes` (buscar, atualizar), `usuarios` (listar, buscar, atualizar, desativar)
  - Todas as procedures filtram por `instituicaoId` (multi-tenancy enforced)

- **M2: Avaliação geriátrica e prontuário**
  - Router `avaliacoesGeriatricas`: listar, buscar, criar, relatório
  - Interpretação automática das escalas: Katz, Lawton, MEEM, GDS-15, MAN, TUG
  - Router `registros`: listar (com filtros), buscar, criar, timeline unificada
  - Router `sinaisVitais`: listar, registrar, último
  - Timeline intercala registros + AGAs + sinais vitais por data
  - Anexos S3-compatible (AWS S3, MinIO, Cloudflare R2, Backblaze B2)
  - Upload direto via URL pré-assinada (5 min de validade)
  - Chaves S3 estruturadas: `instituicoes/{id}/pacientes/{id}/{timestamp}-{nome}`
