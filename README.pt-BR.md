# GerontiCare

<p align="center">
  <a href="README.md">🇺🇸 English</a> · <a href="#portugues">🇧🇷 Português (Brasil)</a>
</p>

<p align="center">
  <img src="geronticare-logo.png" alt="GerontiCare logo" width="400">
</p>

<p align="center">
  <strong>Plataforma open-source de cuidado geriátrico para ILPIs — EHR hoje, ERP de longa permanência amanhã.</strong><br>
  Prontuário multi-tenant para instituições de longa permanência, no caminho de virar o sistema operacional da casa.
</p>

> **⚠️ NÃO ESTÁ PRONTO PARA PRODUÇÃO** — O GerontiCare está em desenvolvimento pré-alfa. **Não utilize com pacientes reais ou em ambientes de produção.** O sistema pode produzir avaliações incorretas, falsos positivos ou perda de dados. Use apenas para desenvolvimento, testes e avaliação.
</p>

### Patrocinador

<p align="center">
  <a href="https://cheaperinference.com"><img src="cheaper-inference-logo.png" alt="Logo da Cheaper Inference" width="72"></a>
</p>

O GerontiCare é patrocinado pela [Cheaper Inference](https://cheaperinference.com), uma API compatível com a OpenAI que oferece acesso a modelos de IA de diferentes provedores, com cobrança por uso e preços reduzidos.

<p align="center">
  <a href="https://github.com/claudioorjunior/geronticare/actions/workflows/ci.yml"><img src="https://github.com/claudioorjunior/geronticare/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://github.com/claudioorjunior/geronticare/blob/main/LICENSE"><img src="https://img.shields.io/badge/licen%C3%A7a-MIT-green.svg" alt="Licença"></a>
  <a href="https://github.com/claudioorjunior/geronticare/releases"><img src="https://img.shields.io/badge/release-v0.5.5-blue.svg" alt="Release v0.5.5"></a>
  <img src="https://img.shields.io/badge/Node-22-339933?logo=node.js" alt="Node 22">
  <img src="https://img.shields.io/badge/PostgreSQL-16--18-4169E1?logo=postgresql" alt="PostgreSQL 16-18">
  <img src="https://img.shields.io/badge/Next.js-16-black?logo=next.js" alt="Next.js 16">
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react" alt="React 19">
  <img src="https://img.shields.io/badge/Tailwind-4-38B2AC?logo=tailwind-css" alt="Tailwind 4">
</p>

---

<a name="portugues"></a>
## 🇧🇷 Português (Brasil)

**GerontiCare** é uma plataforma open-source de cuidado geriátrico feita para **ILPIs** (*Instituições de Longa Permanência para Idosos*) e clínicas geriátricas.

**Hoje** é um prontuário clínico (EHR): evolução multiprofissional, Avaliação Geriátrica Ampla (AGA) com interpretação automática das principais escalas (Katz, Lawton, MEEM, GDS-15, MNA, TUG), sinais vitais e anexos em storage S3-compatible — multi-tenant e com papéis por profissional, numa só interface.

**Nosso objetivo** é transformar o GerontiCare num **ERP completo para ILPIs** — o sistema operacional da instituição — indo além do clínico e cobrindo as camadas administrativa, financeira e operacional da longa permanência, sempre com o prontuário do residente no centro.

### Por que este projeto existe

ILPIs brasileiras e clínicas geriátricas gerenciam um cuidado complexo e multidisciplinar para idosos com ferramentas limitadas — muitas vezes uma mistura de prontuários em papel e planilhas. Informações críticas ficam espalhadas entre profissões (medicina, enfermagem, fisioterapia, terapia ocupacional, nutrição, psicologia, serviço social), dificultando a visão completa do residente e da instituição.

O GerontiCare começa unificando a camada clínica: avaliações geriátricas estruturadas com pontuação automática, linha do tempo multiprofissional e anexos (exames, imagens, documentos) em storage S3-compatible — tudo isolado por instituição via multi-tenancy. A meta de longo prazo é o stack completo da casa em cima desse núcleo.

### Funcionalidades

- **Multi-tenant por design** — os dados de cada instituição são totalmente isolados por `instituicaoId`
- **Autenticação Better-Auth** — email/senha com gerenciamento seguro de sessões
- **Avaliação Geriátrica Ampla (AGA)** com interpretação automática das escalas:
  - **Índice de Katz** (0–6) — independência em AVD
  - **Escala de Lawton** (0–8) — AIVD (atividades instrumentais)
  - **MEEM** (0–30) — Mini-Exame do Estado Mental
  - **GDS-15** (0–15) — Escala de Depressão Geriátrica
  - **MAN** (0–14) — Mini Avaliação Nutricional
  - **TUG** (segundos) — Timed Up and Go, risco de queda
- **Prontuário multiprofissional** — evoluções, prescrições, exames, intercorrências
- **Linha do tempo clínica unificada** — intercala registros + AGAs + sinais vitais por data
- **Monitoramento de sinais vitais** — PA, FC, FR, temperatura, SpO₂, glicemia, peso, altura
- **Anexos S3-compatible** — URLs pré-assinadas para upload direto do browser (AWS S3, MinIO, Cloudflare R2, Backblaze B2)
- **Painel administrativo** — papéis, cargos customizados com catálogo fechado de permissões e **atualizações in-place** no self-hosted
- **API type-safe** via tRPC + validação Zod ponta a ponta

### Stack técnica

| Camada | Escolha |
|---|---|
| Frontend | Next.js 16 (App Router) + React 19 |
| API | tRPC v11 + superjson (type-safe ponta a ponta) |
| Banco de dados | PostgreSQL 16–18 + Drizzle ORM |
| Autenticação | Better-Auth (adapter Drizzle) |
| Validação | Zod 4 |
| Estilização | Tailwind CSS 4 |
| Armazenamento | AWS S3 SDK (S3-compatible) |
| CLI self-hosted | Node 22 + `@clack/prompts` (ESM) |
| Linguagem | TypeScript 5 (strict) |

### Início rápido (self-hosted)

Desde a v0.5.0, o caminho principal para rodar o GerontiCare é o instalador self-hosted — sem precisar clonar o repositório:

```bash
# Requer Node 22 (>=22 <23) e terminal interativo
npx geronticare@latest
```

A CLI conduz todo o processo:

1. **Escolha do banco de dados** — PostgreSQL local (instalado e gerenciado pela CLI quando necessário) ou banco gerenciado na nuvem (Neon ou Supabase).
2. Baixa o `geronticare-app-vX.Y.Z.tar.gz` da release no GitHub, verifica o **SHA-256**, valida a **listagem do tar** (sem symlinks, caminhos absolutos ou travessia `..`) e compila o app com `npm ci` + `next build --webpack`.
3. Aplica as migrations, sobe o servidor e te envia ao navegador para concluir a configuração inicial (instituição + conta admin).

Por padrão o servidor escuta em **http://127.0.0.1:3000** — a porta pode ser trocada com `GERONTICARE_PORT`. Para rodar em segundo plano em vez de segurar o terminal:

```bash
npx geronticare@latest start --background
npx geronticare@latest logs -f
npx geronticare@latest stop
```

> **Sobre permissões** — `config.json` e `secrets.json` são gravados com `0600` e o diretório da instalação é restrito ao seu usuário; o token da configuração inicial é entregue via cookie HttpOnly, SameSite=Strict (validade de 5 minutos). `DATABASE_URL` e `AUTH_SECRET` ficam apenas em `secrets.json` e são injetados no processo do servidor — nunca em `.env`, argumentos de linha de comando ou logs.

### Requisitos (self-hosted)

| Requisito | Detalhe |
|---|---|
| Node.js | **22** (`>=22 <23`) — exigido pela CLI e pelo app |
| Sistema | macOS (13+, x64/arm64), Linux (x64), Windows (10 22H2+, x64) |
| Banco de dados | **PostgreSQL 16–18** — local (gerenciado pela CLI) ou Neon/Supabase |
| Disco | ~**300 MB** livres (verificado antes da instalação) |
| Terminal | TTY interativo para o `install` (prompts) |
| Porta | 3000 por padrão; sobrescreva com `GERONTICARE_PORT` (5432 é reservada) |

> No Linux, o modo de banco local instala o PostgreSQL 16 via `apt` (Ubuntu 22.04/24.04, Debian 12) ou `dnf` (RHEL/Rocky/Alma 9), configurando o repositório oficial PGDG quando a distribuição não oferece a 16 — sempre com sua confirmação. Se nenhuma fonte oferecer, a instalação permanece em `PREFLIGHT` para você trocar para Neon/Supabase.

### Referência da CLI

| Comando | Descrição |
|---|---|
| `npx geronticare@latest` | Instala (ou retoma) e inicia o servidor em foreground |
| `npx geronticare@latest start` | Inicia uma instalação pronta, sem reconfigurar nem baixar de novo |
| `npx geronticare@latest start --background` | Inicia destacado (grava `server.pid`, log em `logs/server.log`) |
| `npx geronticare@latest doctor` | Diagnóstico somente leitura: permissões, lock, integridade da release (SHA-256), porta, processo, banco, migrations, bootstrap |
| `npx geronticare@latest stop` | Para o servidor em background (SIGTERM, limpeza do PID) |
| `npx geronticare@latest logs [-n N] [-f]` | Mostra as últimas `N` linhas (padrão 100) de `logs/server.log`; `-f` acompanha |
| `npx geronticare@latest upgrade [--to X.Y.Z]` | Atualiza para uma versão alvo (padrão: latest) |
| `npx geronticare@latest rollback [--to X.Y.Z]` | Volta para uma versão anterior retida |

`npx geronticare@latest --help` imprime o uso. `install`, `upgrade` e `rollback` tomam um lock de instalação, então operações concorrentes são recusadas. Versões são resolvidas pela API `releases/latest` do GitHub; versão inválida ou downgrade via `upgrade` é rejeitado (use `rollback` para voltar).

### Administração e atualizações (v0.5.5)

Instalações self-hosted podem ser atualizadas in-place, pela interface ou pela CLI:

- **`GET /api/version`** — retorna `{ current, latest, updateAvailable }`. Em cache com `revalidate: 3600` (GitHub `releases/latest`).
- **Sino no TopNav** — somente admin (`admin:administrar`). Só usuários com papel `admin` disparam a checagem de `/api/version`; o badge aparece quando há atualização disponível.
- **`/admin/atualizacao`** — página de atualização do admin. Faz polling de `GET /api/admin/update/status` a cada **2 s** enquanto uma atualização roda e mostra versões atual/disponível, fase em andamento e o resultado (concluída/falha — em caso de falha, a versão anterior continua no ar).
- **`POST /api/admin/update/start`** — somente admin; valida que o alvo é mais novo e dispara o `scripts/upgrade-runner.mjs` (destacado). O runner:
  1. Faz um **backup best-effort** — copia `config.json` + `secrets.json` e, quando disponível, roda `pg_dump` em `<root>/backups/<timestamp>-<versao>/`;
  2. baixa e verifica a release alvo, aplica as migrations (`scripts/migrate.mjs`) e atualiza o `config.json`;
  3. mantém as **2 releases mais recentes** (as antigas são podadas);
  4. faz o **cutover** — para o servidor antigo e sobe o novo (~2–3 s de indisponibilidade).
- **Equivalente na CLI** — `npx geronticare@latest upgrade` (ou `rollback --to X.Y.Z`) com o mesmo backup best-effort e retenção de releases.

> **Notas** — a API de admin vive no app e lê a mesma raiz de instalação da CLI, então só faz sentido em instalações self-hosted (veja `GERONTICARE_HOME` abaixo). O `update-status.json` guarda o estado do job para o polling da UI; migrations são expand-only, mas o servidor antigo continua no ar até o cutover por uma janela curta.

### Estrutura da instalação

A CLI mantém tudo num único diretório persistente (sobrescreva com `GERONTICARE_HOME`; usado em testes e instalações customizadas):

| Sistema | Root |
|---|---|
| macOS | `~/Library/Application Support/GerontiCare` |
| Linux | `${XDG_DATA_HOME:-~/.local/share}/geronticare` |
| Windows | `%LOCALAPPDATA%\GerontiCare` |

```
<root>/
├── config.json               # host, porta, versão, schemaVersion, ativo
├── secrets.json              # DATABASE_URL, AUTH_SECRET, SETUP_TOKEN (0600)
├── install-state.json        # estado da máquina de fases (resumível)
├── install.lock              # lock de instalação/upgrade (PID)
├── server.pid                # PID do servidor em background
├── update-check.json         # cache da checagem de versão (TTL 24h)
├── update-status.json        # estado do job de atualização (UI admin)
├── releases/<versao>/        # releases retidas (máx. 2) + verified.json
├── downloads/releases/       # cache de downloads (tar.gz + .sha256)
├── backups/<ts>-<versao>/    # backups best-effort (config, secrets, dump.sql)
├── logs/server.log           # log do servidor em background
├── staging/                  # área temporária de build (limpa no fim)
└── pgdata/                   # cluster PostgreSQL local dedicado (modo local)
```

A instalação é uma **máquina de estados resumível** com 10 fases — `PREFLIGHT` → `DATABASE_SELECTED` → `DATABASE_READY` → `RELEASE_VERIFIED` → `APP_BUILT` → `CONFIGURED` → `MIGRATED` → `SERVER_READY` → `BOOTSTRAP_PENDING` → `READY`. Qualquer interrupção pode ser retomada rodando `npx geronticare@latest` de novo (um novo `SETUP_TOKEN` é emitido se o anterior expirou); o `doctor` informa a fase atual e sinaliza inconsistências.

### Início rápido (contribuidores / desenvolvimento)

```bash
# 1. Clonar

git clone https://github.com/claudioorjunior/geronticare.git
cd geronticare

# 2. Instalar
npm install

# 3. Configurar (dev — banco PGlite embutido, sem PostgreSQL)
cp .env.development.example .env.local
# DEV_AUTH_BYPASS=true concede acesso local ao usuário admin do seed sem login

# 4. Rodar
npm run dev
# abra http://localhost:3000
```

> Em dev o banco é PGlite embutido (com seed automático) — não precisa de `db:push`.
> Os scripts `db:push`/`db:generate` apontam para um PostgreSQL externo via `DATABASE_URL`.

### Ambiente de produção (a partir do código)

```bash
# Build e execução com PostgreSQL
cp .env.production.example .env.production
# preencha DATABASE_URL, AUTH_SECRET, AUTH_URL, variáveis S3_*
npm run build
npm run start
```

O processo expõe `GET /api/health` como um liveness check sem cache para monitoramento e balanceadores de carga.

#### Como funciona a separação de ambientes

- **`NODE_ENV` é sempre definido pelo Next.js**: `npm run dev` → `development`; `npm run build`/`npm run start` → `production`. Nunca defina manualmente.
- **Bypass de acesso em dev** (`lib/trpc/server.ts`): o acesso ao usuário admin do seed só ativa quando **as duas condições** `NODE_ENV=development` e `DEV_AUTH_BYPASS=true` estão presentes — é *fail-closed* por construção e nunca ativa em build de produção, mesmo que a variável vaze para o ambiente de produção.
- **Conveniência para devs**: defina `DEV_OVERRIDE_USER_ID` para impersonar qualquer usuário do seed (ex.: uma conta `usuario` somente leitura) e testar o comportamento por papel.
- **Produção**: login real via Better-Auth (e-mail/senha). Variável `AUTH_*` ausente ou mal configurada faz a autenticação falhar fechada — o app nunca cai em acesso anônimo.

Releases são destinados a implantações self-hosted com Node.js e PostgreSQL; contribuidores devem fazer fork do `main` e abrir PRs a partir de branches de feature.

### Estrutura do projeto

```
geronticare/
├── app/
│   ├── (app)/                        # UI autenticada (dashboard, pacientes, profissionais,
│   │   │                             #  configuracoes, perfil, admin/atualizacao)
│   ├── api/
│   │   ├── auth/[...all]/route.ts    # Handler Better-Auth
│   │   ├── anexos/upload-url/        # Endpoint URL pré-assinada S3
│   │   ├── health/route.ts           # GET /api/health (liveness, sem cache)
│   │   ├── setup/route.ts            # GET/POST /api/setup (bootstrap do primeiro acesso)
│   │   ├── version/route.ts          # GET /api/version (revalidate 3600)
│   │   ├── admin/update/             # start + status (somente admin, job de update)
│   │   ├── trpc/[trpc]/route.ts      # Handler tRPC
│   │   └── usuarios/                 # endpoints de perfil
│   ├── setup/                        # fluxo de configuração inicial (token-guarded)
│   ├── layout.tsx
│   └── providers.tsx
├── cli/                              # instalador self-hosted (pacote npm `geronticare`)
│   ├── bin/geronticare.js            # entrada CLI (install/start/doctor/stop/logs/upgrade/rollback)
│   └── src/
│       ├── fluxo.js                  # máquina de estados + orquestração install/start
│       ├── servidor.js               # spawn, prontidão, handoff, PID/log em background
│       ├── release.js                # download, SHA-256, listagem do tar, npm ci + build
│       ├── state.js                  # escrita atômica, lock de instalação, PID, fases
│       ├── secrets.js                # secrets.json (0600), redação de URIs
│       ├── backup.js                 # backup best-effort antes do upgrade
│       ├── update-check.js           # checagem de versão com cache de 24h
│       ├── doctor.js                 # diagnóstico somente leitura
│       ├── preflight.js              # checagens Node 22 + TTY
│       ├── porta.js                  # seleção de porta livre
│       ├── ui.js                     # adapter @clack/prompts
│       └── db/                       # setup local/neon/supabase
├── scripts/
│   ├── migrate.mjs                   # aplica migrations (release + CLI)
│   └── upgrade-runner.mjs            # job de upgrade destacado (backup → build → migrate → cutover)
├── components/
│   ├── layout/TopNav.tsx             # TopNav + sino de atualização (admin)
│   └── ui/                           # primitivas de UI
├── lib/
│   ├── auth/                         # Better-Auth servidor + cliente, helpers de sessão
│   ├── db/schema.ts                  # schema (Drizzle)
│   ├── bootstrap.ts                  # lógica do primeiro acesso (token, validação de host)
│   ├── permissoes.ts                 # catálogo de permissões (modulo:acao)
│   ├── storage/s3.ts                 # helpers de storage S3-compatible
│   ├── trpc/                         # contexto, procedures, routers
│   └── validations/escalas.ts        # schemas Zod + interpretação de escalas
├── docs/
│   ├── PRD.md                        # Documento de Requisitos do Produto
│   └── ROADMAP.md                    # Roadmap de desenvolvimento
```

### Scripts

| Script | Descrição |
|---|---|
| `npm run dev` | Servidor de desenvolvimento (PGlite embutido) |
| `npm run build` | Build de produção |
| `npm run start` | Servidor de produção |
| `npm run lint` | ESLint |
| `npm run type-check` | TypeScript (sem emitir) |
| `npm run test` | Testes Vitest (unitários/integração) |
| `npm run test:e2e` | Testes e2e Playwright |
| `npm run db:generate` | Gerar migration SQL |
| `npm run db:migrate` | Aplicar migrations (`scripts/migrate.mjs`) |
| `npm run db:push` | Aplicar schema ao banco |
| `npm run db:studio` | Abrir Drizzle Studio |

### Roadmap

- [x] **M0**: Repositório, CI, branch protection, docs bilíngues
- [x] **M1**: Better-Auth, multi-tenancy, routers instituicoes/usuarios/pacientes
- [x] **M2**: AGA com interpretação de escalas, registros + timeline unificada, sinais vitais, anexos S3
- [x] **M3**: Release v0.1.0 no GitHub
- [x] **v0.3.0**: Perfis de usuário, AGA consolidada, ficha do residente (classificação de dependência RDC 502/2021)
- [x] **v0.4.0**: Painel administrativo — papéis, cargos customizados, catálogo fechado de permissões
- [x] **v0.5.0**: Bootstrap self-hosted — instalador `npx geronticare@latest`, banco local vs. nuvem, releases verificadas, configuração inicial segura
- [x] **v0.5.5**: Atualizações in-place — `start --background`/`stop`/`logs`, `upgrade`/`rollback`, UI de atualização no admin
- [ ] **M4**: UI completa (dashboard, formulários de escalas, timeline visual)
- [ ] **M5**: Auditoria de conformidade LGPD
- [ ] **M6**: Dashboard analítico
- [ ] **M7**: App mobile (React Native)
- [ ] **M8**: Interoperabilidade FHIR R4

Veja [ROADMAP.md](ROADMAP.md) para o plano completo e [PRD.md](PRD.md) para requisitos detalhados.

### Contribuindo

PRs são bem-vindos! Veja [CONTRIBUTING.md](CONTRIBUTING.md) para o guia de contribuição. Abra uma issue primeiro para discutir a abordagem.

### Licença

MIT — veja [LICENSE](LICENSE). Use, fork, construa serviços em cima.

### Mantenedor

Construído por [@claudioorjunior](https://github.com/claudioorjunior) como parte da família **Integra** de ferramentas open-source para cuidado de idosos no Brasil.

---

<p align="center">
  <a href="README.md">🇺🇸 Read in English</a>
</p>
