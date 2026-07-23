# Contributing to GerontiCare

> Contributing / Contribuindo

## English

We welcome contributions to GerontiCare! This document explains how to contribute.

### Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/<your-username>/geronticare.git`
3. Install dependencies: `npm install`
4. Set up your database (see [README.md](README.md))
5. Create a branch: `git checkout -b feat/minha-funcionalidade`

### Development Workflow

- Use **conventional commits**: `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`, `perf:`
- Write TypeScript in **strict mode**
- Run checks before pushing: `npm run lint && npm run type-check`
- All tRPC procedures must be registered in `lib/trpc/root.ts`
- Any schema change requires `npm run db:generate` and `npm run db:push`

### Code Style

- 2-space indentation
- Single quotes for strings
- Semicolons required
- Tailwind for styling (no custom CSS)
- Path alias `@/*` for imports

### Pull Requests

1. Ensure CI passes (lint, type-check, build)
2. Include a clear description of what changed and why
3. Link any related issues
4. Request review from a maintainer

### Testing

- Add unit tests for business logic (escalas geriátricas, validações)
- Add E2E tests for critical flows (auth, AGA, prontuário)
- Use Playwright for E2E

### Reporting Bugs

Use the **Bug Report** issue template.

---

## Português

Contribuições são bem-vindas! Este documento explica como contribuir.

### Começando

1. Faça fork do repositório
2. Clone: `git clone https://github.com/<seu-usuario>/geronticare.git`
3. Instale dependências: `npm install`
4. Configure o banco (veja [README.md](README.md))
5. Crie uma branch: `git checkout -b feat/minha-funcionalidade`

### Fluxo de Desenvolvimento

- Use **conventional commits**: `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`, `perf:`
- Escreva TypeScript em **modo strict**
- Execute verificações antes de enviar: `npm run lint && npm run type-check`
- Toda procedure tRPC deve ser registrada em `lib/trpc/root.ts`
- Qualquer mudança no schema exige `npm run db:generate` e `npm run db:push`

### Estilo de Código

- 2 espaços para indentação
- Aspas simples para strings
- Pontos e vírgulas obrigatórios
- Tailwind para estilização (sem CSS customizado)
- Path alias `@/*` para imports

### Pull Requests

1. Certifique-se de que CI passa (lint, type-check, build)
2. Inclua descrição clara do que mudou e por quê
3. Referencie issues relacionadas
4. Peça revisão a um maintainer

### Testes

- Adicione testes unitários para lógica de negócio (escalas, validações)
- Adicione testes E2E para fluxos críticos (auth, AGA, prontuário)
- Use Playwright para E2E

### Reportando Bugs

Use o template de issue **Bug Report**.
