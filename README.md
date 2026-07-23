# GerontiCare

[![CI](https://github.com/claudioorjunior/geronticare/actions/workflows/ci.yml/badge.svg)](https://github.com/claudioorjunior/geronticare/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Prontuário eletrônico open-source especializado em cuidado geriátrico.**

GerontiCare é um sistema multi-tenant para ILPIs e clínicas de longa permanência que unifica o prontuário multiprofissional, a Avaliação Geriátrica Ampla (AGA) e o monitoramento de sinais vitais em uma única interface pensada para o envelhecimento.

## Stack

- **Next.js 16** (App Router + React 19)
- **tRPC v11** + superjson (APIs type-safe)
- **Drizzle ORM** + PostgreSQL
- **TanStack Query v5**
- **Zod 4** (validação)
- **Tailwind CSS 4**
- **TypeScript 5** (strict)
- **Better-Auth** (em implementação)

## Começando

### Pré-requisitos

- Node.js 20+
- npm
- PostgreSQL (local, Neon ou Supabase)

### Instalação

```bash
git clone https://github.com/claudioorjunior/geronticare.git
cd geronticare
npm install
```

### Configurar banco de dados

1. Crie um banco PostgreSQL e copie a connection string.
2. Crie `.env.local`:

```env
DATABASE_URL="postgresql://user:pass@host:5432/geronticare"
AUTH_SECRET="sua-chave-aleatoria-aqui"
AUTH_URL="http://localhost:3000"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

3. Aplique o schema:

```bash
npm run db:push
```

### Rodar em desenvolvimento

```bash
npm run dev
```

Acesse [http://localhost:3000](http://localhost:3000).

## Scripts

| Script | Descrição |
|--------|-----------|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Build de produção |
| `npm run start` | Servidor de produção |
| `npm run lint` | ESLint |
| `npm run type-check` | TypeScript sem emitir |
| `npm run db:generate` | Gerar migration SQL |
| `npm run db:push` | Aplicar schema ao banco |
| `npm run db:studio` | Abrir Drizzle Studio |

## Arquitetura

```
app/
  api/trpc/[trpc]/route.ts   # Handler tRPC
  layout.tsx                 # Layout raiz
  providers.tsx              # Providers React
lib/
  db/
    schema.ts                # 6 tabelas + 3 enums
    index.ts                 # Cliente Drizzle
  trpc/
    server.ts                # Contexto e procedures
    client.ts                # Cliente React
    root.ts                  # Roteador raiz
    routers/                 # Roteadores por domínio
```

## Status do desenvolvimento

Veja o [ROADMAP.md](ROADMAP.md) para o plano completo e o [PRD.md](PRD.md) para requisitos detalhados.

### MVP (em andamento)

- [x] Schema de banco de dados (6 tabelas, 3 enums)
- [x] Scaffold tRPC + Drizzle
- [x] Router de pacientes (listar, buscar, criar)
- [ ] Autenticação (Better-Auth)
- [ ] AGA com escalas geriátricas
- [ ] Prontuário multiprofissional
- [ ] Sinais vitais

## Contribuindo

Veja [CONTRIBUTING.md](CONTRIBUTING.md) para o guia de contribuição.

## Licença

MIT — veja [LICENSE](LICENSE).
