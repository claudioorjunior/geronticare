# GerontiCare

<p align="center">
  <a href="#english">🇺🇸 English</a> · <a href="README.pt-BR.md">🇧🇷 Português (Brasil)</a>
</p>

<p align="center">
  <img src="geronticare-logo.png" alt="GerontiCare logo" width="400">
</p>

<p align="center">
  <strong>Open-source geriatric care platform for ILPIs — EHR today, ERP for long-term care tomorrow.</strong><br>
  A multi-tenant clinical record for Brazilian long-term care facilities, on the path to becoming a full facility operating system.
</p>

<p align="center">
  <a href="https://github.com/claudioorjunior/geronticare/actions/workflows/ci.yml"><img src="https://github.com/claudioorjunior/geronticare/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://github.com/claudioorjunior/geronticare/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-green.svg" alt="License"></a>
  <a href="https://github.com/claudioorjunior/geronticare/releases"><img src="https://img.shields.io/badge/release-v0.5.5-blue.svg" alt="Release v0.5.5"></a>
  <img src="https://img.shields.io/badge/Node-22-339933?logo=node.js" alt="Node 22">
  <img src="https://img.shields.io/badge/PostgreSQL-16--18-4169E1?logo=postgresql" alt="PostgreSQL 16-18">
  <img src="https://img.shields.io/badge/Next.js-16-black?logo=next.js" alt="Next.js 16">
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react" alt="React 19">
  <img src="https://img.shields.io/badge/Tailwind-4-38B2AC?logo=tailwind-css" alt="Tailwind 4">
</p>

> **⚠️ NOT PRODUCTION READY** — GerontiCare is in early pre-alpha development. **Do not use with real patients or in production environments.** The system may produce incorrect assessments, false positives, or data loss. Use only for development, testing, and evaluation.

### Sponsor

<p align="center">
  <a href="https://cheaperinference.com"><img src="cheaper-inference-logo.png" alt="Cheaper Inference logo" width="72"></a>
</p>

GerontiCare is sponsored by [Cheaper Inference](https://cheaperinference.com), an OpenAI-compatible API that provides access to leading AI models from multiple providers with usage-based pricing and discounted rates.

---

<a name="english"></a>
## 🇺🇸 English

**GerontiCare** is an open-source geriatric care platform built for **ILPIs** (*Instituições de Longa Permanência para Idosos* — Brazilian long-term care facilities for the elderly) and geriatric clinics.

**Today** it is a clinical record (EHR): multiprofessional notes, Comprehensive Geriatric Assessment (CGA/AGA) with automatic interpretation of the main geriatric scales (Katz, Lawton, MEEM, GDS-15, MNA, TUG), vital sign monitoring, and S3-compatible anexos — multi-tenant and role-aware, in one interface.

**Our goal** is to grow GerontiCare into a full **ERP for ILPIs** — the operating system of the facility — extending beyond clinical care into the administrative, financial, and operational layers of long-term care, always with the resident's clinical record at the center.

### Why this exists

Brazilian ILPIs and geriatric clinics manage complex, multidisciplinary care for elderly residents with limited tools — often a mix of paper charts and spreadsheets. Critical information is scattered across professions (medicine, nursing, physiotherapy, occupational therapy, nutrition, psychology, social work), making it hard to see the full clinical picture of the resident or of the facility as a whole.

GerontiCare starts by unifying the clinical layer: structured geriatric assessments with automatic scoring, a multiprofessional timeline, and anexos (lab results, imaging, documents) stored securely in S3-compatible storage — all isolated per institution via multi-tenancy. The long-term aim is the full facility stack on top of that core.

### Features

- **Multi-tenant by design** — each facility's data is fully isolated by `instituicaoId`
- **Better-Auth authentication** — email/password with secure session management
- **Comprehensive Geriatric Assessment (AGA)** with automatic interpretation of scales:
  - **Katz Index** (0–6) — basic ADL independence
  - **Lawton Scale** (0–8) — instrumental ADL (IADL)
  - **MEEM** (0–30) — Mini-Mental State Examination
  - **GDS-15** (0–15) — Geriatric Depression Scale
  - **MNA** (0–14) — Mini Nutritional Assessment
  - **TUG** (seconds) — Timed Up and Go, fall risk
- **Multiprofessional clinical record** — evolution notes, prescriptions, exams, incidents
- **Unified clinical timeline** — interleaves records + CGAs + vital signs by date
- **Vital signs tracking** — BP, heart rate, respiratory rate, temperature, SpO₂, glucose, weight, height
- **S3-compatible attachments** — presigned URLs for direct browser upload (AWS S3, MinIO, Cloudflare R2, Backblaze B2)
- **Admin panel** — roles, custom positions with a closed permission catalog, and self-hosted **in-place upgrades**
- **Type-safe API** via tRPC + Zod validation end-to-end

### Tech stack

| Layer | Choice |
|---|---|
| Frontend | Next.js 16 (App Router) + React 19 |
| API | tRPC v11 + superjson (type-safe end-to-end) |
| Database | PostgreSQL 16–18 + Drizzle ORM |
| Auth | Better-Auth (Drizzle adapter) |
| Validation | Zod 4 |
| Styling | Tailwind CSS 4 |
| Storage | AWS S3 SDK (S3-compatible) |
| Self-hosted CLI | Node 22 + `@clack/prompts` (ESM) |
| Language | TypeScript 5 (strict) |

### Quick start (self-hosted)

Since v0.5.0, the primary way to run GerontiCare is the self-hosted installer — no source checkout needed:

```bash
# Requires Node 22 (>=22 <23) and an interactive terminal
npx geronticare@latest
```

The CLI walks you through everything:

1. **Choose a database** — local PostgreSQL (installed and managed by the CLI when needed) or a managed cloud database (Neon or Supabase).
2. It downloads `geronticare-app-vX.Y.Z.tar.gz` from the GitHub release, verifies the **SHA-256**, validates the **tar listing** (no symlinks, absolute paths, or `..` traversal), and builds the app with `npm ci` + `next build --webpack`.
3. It runs the database migrations, starts the server, and hands you off to the browser to complete the first-run setup (facility + admin account).

By default the server listens on **http://127.0.0.1:3000** — you can change the port with `GERONTICARE_PORT`. To run it in the background instead of holding the terminal:

```bash
npx geronticare@latest start --background
npx geronticare@latest logs -f
npx geronticare@latest stop
```

> **Note on permissions** — `config.json` and `secrets.json` are written with `0600` and the installation directory is restricted to your user; the first-run setup token is delivered through an HttpOnly, SameSite=Strict cookie (5-minute lifetime). `DATABASE_URL` and `AUTH_SECRET` live only in `secrets.json` and are injected into the server process — never in `.env`, command-line args, or logs.

### Requirements (self-hosted)

| Requirement | Detail |
|---|---|
| Node.js | **22** (`>=22 <23`) — required by the CLI and the app |
| OS | macOS (13+, x64/arm64), Linux (x64), Windows (10 22H2+, x64) |
| Database | **PostgreSQL 16–18** — local (managed by the CLI) or Neon/Supabase |
| Disk | ~**300 MB** free (checked before installing) |
| Terminal | Interactive TTY for `install` (prompts) |
| Port | 3000 by default; override with `GERONTICARE_PORT` (5432 is reserved) |

> On Linux, the local-database mode installs PostgreSQL 16 via `apt` (Ubuntu 22.04/24.04, Debian 12) or `dnf` (RHEL/Rocky/Alma 9), configuring the official PGDG repository when the distro does not offer 16 — with your confirmation. If no source offers it, the installation stays in `PREFLIGHT` so you can switch to Neon/Supabase.

### CLI reference

| Command | Description |
|---|---|
| `npx geronticare@latest` | Install (or resume) and start the server in the foreground |
| `npx geronticare@latest start` | Start a ready installation without reconfiguring or re-downloading |
| `npx geronticare@latest start --background` | Start detached (writes `server.pid`, logs to `logs/server.log`) |
| `npx geronticare@latest doctor` | Read-only diagnostics: permissions, lock, release integrity (SHA-256), port, process, DB, migrations, bootstrap |
| `npx geronticare@latest stop` | Stop the background server (SIGTERM, PID cleanup) |
| `npx geronticare@latest logs [-n N] [-f]` | Show the last `N` lines (default 100) of `logs/server.log`; `-f` follows |
| `npx geronticare@latest upgrade [--to X.Y.Z]` | Upgrade to a target version (default: latest release) |
| `npx geronticare@latest rollback [--to X.Y.Z]` | Roll back to a previously retained version |

`npx geronticare@latest --help` prints the usage. `install`, `upgrade` and `rollback` take an installation lock, so concurrent operations are rejected. Versions resolve from the GitHub `releases/latest` API; a wrong version or a downgrade via `upgrade` is rejected (use `rollback` to go back).

### Admin & updates (v0.5.5)

Self-hosted installations can be upgraded in place, from the UI or the CLI:

- **`GET /api/version`** — returns `{ current, latest, updateAvailable }`. Cached with `revalidate: 3600` (GitHub `releases/latest`).
- **TopNav bell** — admin-only (`admin:administrar`). Only users with the `admin` role trigger the `/api/version` check; the badge appears when an update is available.
- **`/admin/atualizacao`** — the admin update page. It polls `GET /api/admin/update/status` every **2 s** while an update is running and shows the current/latest versions, the running phase, and the result (done/failed — the previous version keeps serving on failure).
- **`POST /api/admin/update/start`** — admin-only, validates that the target is newer, then spawns `scripts/upgrade-runner.mjs` (detached). The runner:
  1. Takes a **best-effort backup** — copies `config.json` + `secrets.json` and, when available, runs `pg_dump` into `<root>/backups/<timestamp>-<versao>/`;
  2. downloads and verifies the target release, applies migrations (`scripts/migrate.mjs`), and updates `config.json`;
  3. keeps the **2 most recent releases** (older ones are pruned);
  4. performs the **cutover** — stops the old server and starts the new one (~2–3 s of downtime).
- **CLI equivalent** — `npx geronticare@latest upgrade` (or `rollback --to X.Y.Z`) with the same best-effort backup and release retention.

> **Notes** — the admin API lives in the app and reads the same installation root as the CLI, so it is only meaningful in self-hosted setups (see `GERONTICARE_HOME` below). `update-status.json` keeps the job state for the polling UI; migrations are expand-only, but the old server stays up until the cutover for a short window.

### Installation layout

The CLI keeps everything in one persistent directory (override with `GERONTICARE_HOME`; used by tests and custom installs):

| OS | Root |
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
├── update-status.json        # estado do job de atualização (admin UI)
├── releases/<versao>/        # releases retidas (máx. 2) + verified.json
├── downloads/releases/       # cache de downloads (tar.gz + .sha256)
├── backups/<ts>-<versao>/    # backups best-effort (config, secrets, dump.sql)
├── logs/server.log           # log do servidor em background
├── staging/                  # área temporária de build (limpa no fim)
└── pgdata/                   # cluster PostgreSQL local dedicado (modo local)
```

The installation is a **resumable state machine** with 10 phases — `PREFLIGHT` → `DATABASE_SELECTED` → `DATABASE_READY` → `RELEASE_VERIFIED` → `APP_BUILT` → `CONFIGURED` → `MIGRATED` → `SERVER_READY` → `BOOTSTRAP_PENDING` → `READY`. Any interruption can be resumed by running `npx geronticare@latest` again (a fresh `SETUP_TOKEN` is issued if the previous one expired); `doctor` reports the current phase and flags inconsistencies.

### Quick start (contributors / development)

```bash
# 1. Clone
git clone https://github.com/claudioorjunior/geronticare.git
cd geronticare

# 2. Install
npm install

# 3. Configure (development — embedded PGlite DB, no PostgreSQL needed)
cp .env.development.example .env.local
# DEV_AUTH_BYPASS=true grants local access to the seed admin without login

# 4. Run
npm run dev
# open http://localhost:3000
```

> Dev uses an embedded PGlite database (seeded automatically) — no `db:push` needed.
> The `db:push`/`db:generate` scripts target an external PostgreSQL via `DATABASE_URL`.

### Production environment (from source)

```bash
# Build and serve with PostgreSQL
cp .env.production.example .env.production
# fill in DATABASE_URL, AUTH_SECRET, AUTH_URL, S3_* vars
npm run build
npm run start
```

The process exposes `GET /api/health` as a cache-free liveness check for monitoring and load balancers.

#### How the environment separation works

- **`NODE_ENV` is always set by Next.js**: `npm run dev` → `development`, `npm run build`/`npm run start` → `production`. You never set it manually.
- **Dev access bypass** (`lib/trpc/server.ts`): seed admin access only activates when **both** `NODE_ENV=development` and `DEV_AUTH_BYPASS=true` are present — it is *fail-closed* by construction and can never activate in a production build, even if the variable leaks into production env.
- **Developer convenience**: set `DEV_OVERRIDE_USER_ID` to impersonate any seed user (e.g. a `usuario` read-only account) to test role behavior.
- **Production**: real login via Better-Auth (email/password). A missing or misconfigured `AUTH_*` variable makes auth fail closed — the app never falls back to anonymous access.

Releases target self-hosted deployments with Node.js and PostgreSQL; contributors should fork `main` and open PRs from feature branches.

### Project structure

```
geronticare/
├── app/
│   ├── (app)/                        # authed UI (dashboard, pacientes, profissionais,
│   │   │                             #  configuracoes, perfil, admin/atualizacao)
│   ├── api/
│   │   ├── auth/[...all]/route.ts    # Better-Auth handler
│   │   ├── anexos/upload-url/        # S3 presigned URL endpoint
│   │   ├── health/route.ts           # GET /api/health (liveness, no cache)
│   │   ├── setup/route.ts            # GET/POST /api/setup (first-run bootstrap)
│   │   ├── version/route.ts          # GET /api/version (revalidate 3600)
│   │   ├── admin/update/             # start + status (admin-only, update job)
│   │   ├── trpc/[trpc]/route.ts      # tRPC handler
│   │   └── usuarios/                 # profile endpoints
│   ├── setup/                        # first-run setup flow (token-guarded)
│   ├── layout.tsx
│   └── providers.tsx
├── cli/                              # self-hosted installer (npm package `geronticare`)
│   ├── bin/geronticare.js            # CLI entry (install/start/doctor/stop/logs/upgrade/rollback)
│   └── src/
│       ├── fluxo.js                  # state machine + install/start orchestration
│       ├── servidor.js               # spawn, readiness, handoff, background PID/logs
│       ├── release.js                # download, SHA-256, tar listing, npm ci + build
│       ├── state.js                  # atomic writes, install lock, PID, phase state
│       ├── secrets.js                # secrets.json (0600), redaction
│       ├── backup.js                 # best-effort pre-upgrade backup
│       ├── update-check.js           # version check with 24h cache
│       ├── doctor.js                 # read-only diagnostics
│       ├── preflight.js              # Node 22 + TTY checks
│       ├── porta.js                  # free-port selection
│       ├── ui.js                     # @clack/prompts adapter
│       └── db/                       # local/neon/supabase database setup
├── scripts/
│   ├── migrate.mjs                   # run DB migrations (release + CLI)
│   └── upgrade-runner.mjs            # detached upgrade job (backup → build → migrate → cutover)
├── components/
│   ├── layout/TopNav.tsx             # TopNav + admin-only update bell
│   └── ui/                           # UI primitives
├── lib/
│   ├── auth/                         # Better-Auth server + client, session helpers
│   ├── db/schema.ts                  # schema (Drizzle)
│   ├── bootstrap.ts                  # first-run setup logic (token, host validation)
│   ├── permissoes.ts                 # permission catalog (modulo:acao)
│   ├── storage/s3.ts                 # S3-compatible storage helpers
│   ├── trpc/                         # context, procedures, routers
│   └── validations/escalas.ts        # Zod schemas + scale interpretation
├── docs/
│   ├── PRD.md                        # Product Requirements Document
│   └── ROADMAP.md                    # Development roadmap
```

### Scripts

| Script | Description |
|---|---|
| `npm run dev` | Development server (PGlite embedded) |
| `npm run build` | Production build |
| `npm run start` | Production server |
| `npm run lint` | ESLint |
| `npm run type-check` | TypeScript (no emit) |
| `npm run test` | Vitest unit/integration tests |
| `npm run test:e2e` | Playwright e2e tests |
| `npm run db:generate` | Generate SQL migration |
| `npm run db:migrate` | Apply migrations (`scripts/migrate.mjs`) |
| `npm run db:push` | Push schema to database |
| `npm run db:studio` | Open Drizzle Studio |

### Roadmap

- [x] **M0**: Repository, CI, branch protection, bilingual docs
- [x] **M1**: Better-Auth, multi-tenant enforcement, instituicoes/usuarios/pacientes routers
- [x] **M2**: AGA with scale interpretation, registros + unified timeline, sinais vitais, S3 attachments
- [x] **M3**: Release v0.1.0 on GitHub
- [x] **v0.3.0**: User profiles, consolidated AGA, resident record (RDC 502/2021 dependency classification)
- [x] **v0.4.0**: Admin panel — roles, custom positions, closed permission catalog
- [x] **v0.5.0**: Self-hosted bootstrap — `npx geronticare@latest` installer, local vs. cloud database, verified releases, secure first-run setup
- [x] **v0.5.5**: In-place upgrades — `start --background`/`stop`/`logs`, `upgrade`/`rollback`, admin update UI
- [ ] **M4**: Full UI (dashboard, scale forms, visual timeline)
- [ ] **M5**: LGPD compliance audit
- [ ] **M6**: Analytics dashboard
- [ ] **M7**: React Native mobile app
- [ ] **M8**: FHIR R4 interoperability

See [ROADMAP.md](ROADMAP.md) for the full plan and [PRD.md](PRD.md) for detailed requirements.

### Contributing

PRs welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for the contribution guide. Open an issue first to discuss the approach.

### License

MIT — see [LICENSE](LICENSE). Use it, fork it, build services around it.

### Maintainer

Built by [@claudioorjunior](https://github.com/claudioorjunior) as part of the **Integra** family of open-source tools for Brazilian eldercare.

---

<p align="center">
  <a href="README.pt-BR.md">🇧🇷 Ler em Português (Brasil)</a>
</p>
