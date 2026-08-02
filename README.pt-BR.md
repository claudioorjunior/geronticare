# GerontiCare

<p align="center">
  <a href="README.md">🇺🇸 English</a> · <a href="#portugues">🇧🇷 Português (Brasil)</a>
</p>

<p align="center">
  <img src="geronticare-logo.png" alt="GerontiCare logo" width="400">
</p>

<p align="center">
  <strong>Prontuário eletrônico open-source especializado em cuidado geriátrico.</strong><br>
  Um sistema multi-tenant para ILPIs e clínicas geriátricas.
</p>

> **⚠️ NÃO ESTÁ PRONTO PARA PRODUÇÃO** — O GerontiCare está em desenvolvimento pré-alfa. **Não utilize com pacientes reais ou em ambientes de produção.** O sistema pode produzir avaliações incorretas, falsos positivos ou perda de dados. Use apenas para desenvolvimento, testes e avaliação.
</p>

<p align="center">
  <a href="https://github.com/claudioorjunior/geronticare/actions/workflows/ci.yml"><img src="https://github.com/claudioorjunior/geronticare/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://github.com/claudioorjunior/geronticare/blob/main/LICENSE"><img src="https://img.shields.io/badge/licen%C3%A7a-MIT-green.svg" alt="Licença"></a>
  <a href="https://github.com/claudioorjunior/geronticare/releases"><img src="https://img.shields.io/badge/release-v0.1.0-blue.svg" alt="Release v0.1.0"></a>
  <img src="https://img.shields.io/badge/Next.js-16-black?logo=next.js" alt="Next.js 16">
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react" alt="React 19">
  <img src="https://img.shields.io/badge/PostgreSQL-Drizzle-4169E1?logo=postgresql" alt="PostgreSQL + Drizzle">
  <img src="https://img.shields.io/badge/Tailwind-4-38B2AC?logo=tailwind-css" alt="Tailwind 4">
</p>

---

<a name="portugues"></a>
## 🇧🇷 Português (Brasil)

**GerontiCare** é um sistema de prontuário eletrônico (EHR) open-source especializado em cuidado geriátrico, projetado para **ILPIs** (*Instituições de Longa Permanência para Idosos*) e clínicas geriátricas.

Ele unifica o prontuário multiprofissional, a Avaliação Geriátrica Ampla (AGA) e o monitoramento de sinais vitais em uma única interface pensada para o envelhecimento — com interpretação automática das escalas geriátricas mais utilizadas (Katz, Lawton, MEEM, GDS-15, MAN, TUG).

### Por que este projeto existe

ILPIs brasileiras e clínicas geriátricas gerenciam um cuidado complexo e multidisciplinar para idosos com ferramentas limitadas — muitas vezes uma mistura de prontuários em papel e planilhas. Informações críticas estão espalhadas entre profissões (medicina, enfermagem, fisioterapia, terapia ocupacional, nutrição, psicologia, serviço social), dificultando a visão completa do quadro clínico.

O GerontiCare reúne tudo: avaliações geriátricas estruturadas com pontuação automática, uma linha do tempo clínica unificada entre todas as profissões, e anexos (resultados de exames, imagens, documentos) armazenados com segurança em storage S3-compatible — tudo isolado por instituição via multi-tenancy.

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
- **API type-safe** via tRPC + validação Zod ponta a ponta

### Stack técnica

| Camada | Escolha |
|---|---|
| Frontend | Next.js 16 (App Router) + React 19 |
| API | tRPC v11 + superjson (type-safe ponta a ponta) |
| Banco de dados | PostgreSQL + Drizzle ORM |
| Autenticação | Better-Auth (adapter Drizzle) |
| Validação | Zod 4 |
| Estilização | Tailwind CSS 4 |
| Armazenamento | AWS S3 SDK (S3-compatible) |
| Linguagem | TypeScript 5 (strict) |

### Início rápido (desenvolvimento)

```bash
# 1. Clonar

git clone https://github.com/claudioorjunior/geronticare.git
cd geronticare

# 2. Instalar
npm install

# 3. Configurar (dev — banco PGlite embutido, sem PostgreSQL)
cp .env.development.example .env.local
# DEV_AUTH_BYPASS=true já concede sessão admin do seed sem login

# 4. Rodar
npm run dev
# abra http://localhost:3000
```

> Em dev o banco é PGlite embutido (com seed automático) — não precisa de `db:push`.
> Os scripts `db:push`/`db:generate` apontam para um PostgreSQL externo via `DATABASE_URL`.

### Ambiente de produção

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
- **Bypass de acesso em dev** (`lib/trpc/server.ts`): a sessão admin do seed só ativa quando **as duas condições** `NODE_ENV=development` e `DEV_AUTH_BYPASS=true` estão presentes — é *fail-closed* por construção e nunca ativa em build de produção, mesmo que a variável vaze para o ambiente de produção.
- **Conveniência para devs**: defina `DEV_OVERRIDE_USER_ID` para impersonar qualquer usuário do seed (ex.: uma conta `usuario` somente leitura) e testar o comportamento por papel.
- **Produção**: login real via Better-Auth (e-mail/senha). Variável `AUTH_*` ausente ou mal configurada faz a autenticação falhar fechada — o app nunca cai em acesso anônimo.

Releases são destinados a implantações de produção com Node.js e PostgreSQL; contribuidores devem fazer fork do `main` e abrir PRs a partir de branches de feature.

### Estrutura do projeto

```
geronticare/
├── app/
│   ├── api/
│   │   ├── auth/[...all]/route.ts   # Handler Better-Auth
│   │   ├── anexos/upload-url/        # Endpoint URL pré-assinada S3
│   │   └── trpc/[trpc]/route.ts      # Handler tRPC
│   ├── layout.tsx
│   └── providers.tsx
├── lib/
│   ├── auth/
│   │   ├── index.ts                  # Config Better-Auth (servidor)
│   │   └── client.ts                 # Cliente React Better-Auth
│   ├── db/
│   │   ├── schema.ts                 # 10 tabelas + 3 enums
│   │   └── index.ts                  # Cliente Drizzle
│   ├── storage/
│   │   └── s3.ts                     # Helpers de storage S3-compatible
│   ├── trpc/
│   │   ├── server.ts                 # Contexto + procedures (auth, multi-tenant)
│   │   ├── client.ts                 # Cliente tRPC React
│   │   ├── root.ts                   # Router raiz
│   │   └── routers/                  # Routers por domínio
│   │       ├── instituicoes.ts
│   │       ├── usuarios.ts
│   │       ├── pacientes.ts
│   │       ├── avaliacoesGeriatricas.ts
│   │       ├── registros.ts
│   │       └── sinaisVitais.ts
│   └── validations/
│       └── escalas.ts                # Schemas Zod + interpretação de escalas
└── docs/
    ├── PRD.md                        # Documento de Requisitos do Produto
    └── ROADMAP.md                    # Roadmap de desenvolvimento
```

### Scripts

| Script | Descrição |
|---|---|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Build de produção |
| `npm run start` | Servidor de produção |
| `npm run lint` | ESLint |
| `npm run type-check` | TypeScript (sem emitir) |
| `npm run db:generate` | Gerar migration SQL |
| `npm run db:push` | Aplicar schema ao banco |
| `npm run db:studio` | Abrir Drizzle Studio |

### Roadmap

- [x] **M0**: Repositório, CI, branch protection, docs bilíngues
- [x] **M1**: Better-Auth, multi-tenancy, routers instituicoes/usuarios/pacientes
- [x] **M2**: AGA com interpretação de escalas, registros + timeline unificada, sinais vitais, anexos S3
- [x] **M3**: Release v0.1.0 no GitHub
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
