# Changelog

Todos os mudanças notáveis deste projeto serão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/),
e este projeto adere ao [Versionamento Semântico](https://semver.org/lang/pt-BR/).

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
