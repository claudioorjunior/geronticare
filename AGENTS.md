# GerontiCare

Sistema open-source de prontuário eletrônico especializado em cuidado geriátrico (ILPIs e clínicas de longa permanência). Multi-tenant, em português (pt-BR).

## Stack

- Next.js 16.2.11 (App Router, React 19.2)
- tRPC v11 + superjson (transformer shared entre client/server)
- Drizzle ORM 0.45 + PostgreSQL via `postgres` (pool mode, `prepare: false`)
- TanStack Query v5
- Zod 4 (validação de input nas procedures)
- Tailwind CSS 4
- TypeScript 5 em modo strict
- Auth planejada: Better-Auth (não implementada ainda)

## Scripts

```bash
npm run dev          # next dev (http://localhost:3000)
npm run build        # next build
npm run type-check   # tsc --noEmit
npm run lint         # eslint
npm run db:generate  # drizzle-kit generate (gera migration SQL)
npm run db:push      # drizzle-kit push (aplica schema ao DB)
npm run db:studio    # drizzle-kit studio
```

## Variáveis de ambiente (.env.local)

- `DATABASE_URL` — connection string PostgreSQL (obrigatória, usada com `!` em `lib/db/index.ts`)
- `AUTH_SECRET`, `AUTH_URL` — reservadas para Better-Auth
- `NEXT_PUBLIC_APP_URL`

## Estrutura

```
app/
  api/trpc/[trpc]/route.ts   # handler tRPC (GET/POST)
  layout.tsx                 # Geist fonts, lang pt-BR, Providers
  providers.tsx              # 'use client' — tRPC + QueryClient
  page.tsx                   # home (placeholder do create-next-app)
lib/
  db/
    schema.ts                # 6 tabelas + 3 enums (fonte da verdade do domínio)
    index.ts                 # cliente Drizzle (export `db`)
    migrations/              # *.sql gitignored; manter .gitkeep
  trpc/
    server.ts                # createTRPCContext, publicProcedure, protectedProcedure
    client.ts                # createTRPCReact<AppRouter> + httpBatchLink
    root.ts                  # appRouter (type AppRouter exportado)
    routers/                 # um arquivo por domínio (ex: pacientes.ts)
  auth/                      # vazio — Better-Auth a implementar
  validations/               # vazio — schemas Zod reutilizáveis a criar
```

## Camadas e regras de edição

- **Schema é fonte da verdade**: tabelas em `lib/db/schema.ts` (`instituicoes`, `usuarios`, `pacientes`, `avaliacoes_geriatricas`, `registros`, `sinais_vitais`). Enums: `sexo`, `estado_civil`, `especialidade` (8 especialidades de saúde). Qualquer mudança de domínio começa aqui, depois `db:generate`/`db:push`.
- **Multi-tenant**: toda tabela de domínio tem `instituicaoId`. Procedures devem sempre filtrar/escopar por instituição do usuário logado.
- **tRPC**: cada entidade vira um router em `lib/trpc/routers/` e deve ser registrada em `lib/trpc/root.ts`. Use `protectedProcedure` para rotas autenticadas, `publicProcedure` só para login/registro.
- **Transformer superjson**: obrigatório em ambos os lados (client em `client.ts`, server em `server.ts`). Datas/Dates passam por ele — não serializar manualmente.
- **Validação**: input com Zod dentro de `.input(z.object({...}))`. Schemas reutilizáveis devem ir para `lib/validations/`.
- **Path alias**: `@/*` → raiz do projeto (ex: `@/lib/db`). Usar sempre, não imports relativos profundos.
- **App Router**: componentes server por padrão; marcar `'use client'` só onde houver hook/event handler. Providers já envolvem a app.

## Estado atual e gotchas

- **Auth NÃO implementada**: `lib/trpc/server.ts` tem `isAuthenticated` com placeholder `userId: 'temp-user-id'` e `pacientes.criar` grava `instituicaoId: 'temp-instituicao-id'`. Implementar Better-Auth e injetar `instituicaoId` real no contexto antes de qualquer dado de produção.
- **`lib/auth/` e `lib/validations/` estão vazios** — prontos para receber Better-Auth e schemas compartilhados.
- **Apenas `pacientesRouter` existe** (listar, buscar, criar). Demais entidades do schema ainda não têm router.
- **`page.tsx` é o boilerplate do create-next-app** — ainda não há UI real do produto.
- **Git não inicializado**: `git init` ainda pendente (ver `SETUP_COMPLETO.txt`).
- **Migrations SQL são gitignored** (`lib/db/migrations/*.sql`), exceto `.gitkeep`. Use `db:generate` para regenerar.
- **`postgres` em pool mode**: `prepare: false` em `lib/db/index.ts` — necessário para Neon/Supabase transaction mode, não remover.

## Convenções

- Código e comentários em português onde fizer sentido (nomes de tabela, enums, campos); identificadores de variável em inglês/pt conforme o existente.
- Timestamps: `createdAt`/`updatedAt` com `.defaultNow().notNull()`.
- UUIDs como PK (`uuid('id').primaryKey().defaultRandom()`).
- Endereços e contatos como `jsonb` tipado via `.$type<{...}>()`.

## Antes de mexer em áreas sensíveis

- Ler `SETUP_COMPLETO.txt` (contexto de criação, roadmap MVP, decisões de schema).
- Mudanças em `lib/db/schema.ts` exigem `db:generate` + `db:push` e atualização de queries dependentes.
- Adicionar nova procedure: registrar no `appRouter` em `root.ts`, senão não fica exposta.
