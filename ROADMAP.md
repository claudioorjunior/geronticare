# Roadmap — GerontiCare

**Atualizado em:** 2026-07-23 · v0.1
**Período:** MVP (M0–M3) → v1.0 (M3–M6) → v2.0 (M6+)

---

## Visão geral

```
M0 ▸ Fundação e identidade open-source  ▸████████
M1 ▸ Auth, multi-tenant, cadastros       ▸████████
M2 ▸ AGA + prontuário multiprofissional  ▸████████
M3 ▸ MVP público v0.1.0 no GitHub        ▸████████ ◀ release pública inicial
M4 ▸ Sinais vitais, relatórios, UX       ▸████████
M5 ▸ Operação, RBAC, auditoria           ▸████████
M6 ▸ v1.0 estável em produção            ▸████████ ◀ release pública LTS
M7+ ▸ Portal família, RNDS, mobile PWA   ▸████████
```

---

## M0 — Fundação e identidade open-source (Semanas 1–2)

**Objetivo:** deixar o repositório pronto para receber contribuições e hospedar o MVP.

- [ ] `git init` e primeiro commit
- [ ] `gh repo create geronticare --public --source=. --push` (publicar no GitHub)
- [ ] Adicionar `README.md` real (substituir boilerplate do create-next-app)
  - Badges: build, license, stars
  - Visão, screenshots, quick start, contribuição
- [ ] Adicionar `CONTRIBUTING.md` (fluxo de PR, conventional commits, code style)
- [ ] Adicionar `CODE_OF_CONDUCT.md` (Contributor Covenant)
- [ ] Adicionar templates de issue (`bug`, `feature`)
- [ ] Adicionar `SECURITY.md` com política de reporte
- [ ] Configurar CI mínimo: GitHub Actions rodando `npm run lint`, `npm run type-check`, `npm run build`
- [ ] Branch protection em `main` (require PR + 1 review + CI verde)
- [ ] LICENSE já é MIT — confirmar cabeçalho de copyright nos arquivos principais

**Entregável:** `github.com/integra-senior/geronticare` público com CI verde.

---

## M1 — Auth, multi-tenant e cadastros (Semanas 3–4)

**Objetivo:** autenticação real e CRUD básico das entidades núcleo.

### M1.A — Autenticação
- [ ] Instalar e configurar Better-Auth (`lib/auth/`)
- [ ] `auth.ts` server-side: providers e-mail/senha, hash, sessões
- [ ] Endpoints REST em `app/api/auth/[...all]/route.ts`
- [ ] Tela de login e tela de cadastro de instituição (onboarding)
- [ ] Logout, refresh de sessão, proteção de rotas via middleware
- [ ] Substituir `userId` e `instituicaoId` placeholders em `lib/trpc/server.ts` por leitura real do contexto

### M1.B — Multi-tenant enforcement
- [ ] Helper `requireInstituicao(ctx)` em `lib/trpc/server.ts`
- [ ] Middleware tRPC que valida `instituicaoId` da sessão em toda procedure
- [ ] Teste E2E: usuário da instituição A não vê pacientes da B

### M1.C — CRUDs base
- [ ] Router `instituicoes` (buscar, atualizar dados da própria instituição)
- [ ] Router `usuarios` (listar, convidar, desativar, trocar especialidade)
- [ ] Router `pacientes` (completar: atualizar, desativar, busca por nome/CPF/datas)
- [ ] Schemas Zod compartilhados em `lib/validations/` (paciente, usuário, instituição)

### M1.D — UI mínima de cadastros
- [ ] Layout autenticado (`app/(authed)/layout.tsx`) com header e menu lateral
- [ ] Telas: lista de pacientes, ficha de paciente (CRUD)
- [ ] Telas: lista de profissionais, convite e edição

**Entregável:** usuário consegue criar conta, cadastrar instituição, convidar colega, cadastrar e editar pacientes.

---

## M2 — AGA e prontuário multiprofissional (Semanas 5–8)

**Objetivo:** núcleo clínico do produto — escalas validadas e timeline multiprofissional.

### M2.A — Avaliação Geriátrica Ampla
- [ ] Router `avaliacoesGeriatricas` (criar, listar por paciente, buscar por id)
- [ ] Formulários UI para cada escala: Katz, Lawton, MEEM, GDS-15, MAN, TUG
- [ ] Validação Zod dos scores (faixas de cada escala)
- [ ] Cálculo de interpretação automática por escala (ex: Katz 0 = dependente total)
- [ ] Relatório consolidado da AGA (uma página imprimível)
- [ ] Comparação AGA atual × anterior (delta visual)

### M2.B — Prontuário multiprofissional
- [ ] Router `registros` (criar, listar por paciente com paginação, editar)
- [ ] Formulário de evolução com seleção de especialidade
- [ ] Timeline clínica unificada (`app/(authed)/pacientes/[id]/prontuario`)
- [ ] Filtros: por especialidade, por período, por autor
- [ ] Marcação de intercorrência crítica (destaque visual)
- [ ] Auditoria mínima: `createdBy`, `createdAt`, `updatedBy`

### M2.C — Anexos
- [ ] Storage S3-compatible (R2/MinIO) — driver configurável
- [ ] Upload de arquivo no registro de prontuário
- [ ] Galeria simples de anexos por paciente

**Entregável:** médico aplica AGA completa, equipe multiprofissional registra evolução, todos veem timeline unificada.

---

## M3 — MVP público v0.1.0 no GitHub (Semanas 9–10)

**Objetivo:** primeira release pública utilizável por instituições-piloto.

### M3.A — Hardening pré-release
- [ ] Cobertura de testes E2E mínima (Playwright) para fluxos críticos
- [ ] Testes unitários dos interpretadores de escala
- [ ] `npm audit` sem vulnerabilidades críticas
- [ ] Documentação: ARCHITECTURE.md, DEPLOYMENT.md (Neon + Vercel + R2)
- [ ] Demo seed script: 1 instituição, 3 profissionais, 10 pacientes com AGA

### M3.B — Release
- [ ] Tag `v0.1.0` no GitHub
- [ ] Notas de release em `CHANGELOG.md`
- [ ] Anúncio no README e em canais da Integra Senior
- [ ] Onboarding de 3–5 instituições-piloto

**Entregável:** `v0.1.0` publicado e instituições-piloto usando em produção paralela ao papel.

---

## M4 — Sinais vitais, relatórios e UX (Semanas 11–13)

**Objetivo:** completar o ciclo clínico do MVP e melhorar experiência de uso.

- [ ] Router `sinaisVitais` (registrar, listar por paciente, último valor, série temporal)
- [ ] UI de registro rápido (mobile-first) para turno de enfermagem
- [ ] Gráficos de série temporal por sinal vital (recharts ou chart.js)
- [ ] Alertas visuais por faixa de normalidade geriátrica (configurável por instituição)
- [ ] Cabeçalho do paciente com últimos sinais vitais
- [ ] Relatórios operacionais (pacientes ativos por especialidade, AGAs no mês)
- [ ] Export PDF de prontuário e de AGA

**Entregável:** ciclo clínico completo (anamnese → AGA → evolução → sinais vitais → relatório).

---

## M5 — Operação, RBAC e auditoria (Semanas 14–16)

**Objetivo:** preparar o sistema para uso sério em produção.

- [ ] RBAC por papel × especialidade × ação
- [ ] Logs de auditoria persistidos em tabela dedicada
- [ ] Painel admin: métricas, lista de usuários, lista de instituições
- [ ] Export completo de dados da instituição (portabilidade LGPD)
- [ ] Backup automatizado documentado (script + cron)
- [ ] Sentry ou alternativa de observabilidade configurada

---

## M6 — v1.0 estável (Semanas 17–20)

**Objetivo:** primeira versão LTS.

- [ ] Release `v1.0.0` com notas de release detalhadas
- [ ] Documentação completa (manual do usuário, manual do admin, API reference)
- [ ] Testes de carga: validar p95 < 500ms com 1.000 pacientes por instituição
- [ ] Auditoria de segurança externa (pentest leve)
- [ ] Plano de manutenção e suporte publicado
- [ ] Política de LGPD revisada por DPO

**Entregável:** `v1.0.0` em produção em pelo menos 20 instituições.

---

## M7+ — Visão pós-v1.0

### v1.1 (Q seguinte)
- Portal da família (read-only autenticado por CPF + código)
- PWA com offline-first para registro em visita domiciliar
- Notificações por e-mail para eventos críticos

### v1.2
- Integração com laboratórios (TISS, HL7 FHIR básico)
- Prescrição eletrônica simples (sem dispensação)
- Relatórios epidemiológicos da instituição

### v2.0 (visão de longo prazo)
- Integração RNDS / DATASUS
- Telemedicina síncrona
- Mobile nativo (React Native)
- Marketplace de plugins da comunidade

---

## Marcos e métricas

| Marco | Data alvo | Métrica de sucesso |
|---|---|---|
| Repositório público | M0 fim | Repo no ar + CI verde |
| Piloto 1 funcionando | M3 meio | 1 ILPI usando diariamente |
| Release v0.1.0 | M3 fim | 5 instituições-piloto |
| Release v1.0.0 | M6 fim | 20 instituições ativas |
| NPS ≥ 40 | M6 fim | Pesquisa com 3+ profissionais/instituição |
| 0 incidentes multi-tenant | contínuo | Testes automatizados em CI |

---

## Dependências críticas

- **D14 (storage de anexos)** precisa ser decidida antes de M2.C.
- **D15 (RBAC)** precisa ser decidida antes de M1.D.
- **D11 (deploy)** precisa estar decidida antes de M3.
- **DPO/LGPD review** precisa acontecer até M1 para evitar retrabalho.

---

## Referências

- `PRD.md` — requisitos detalhados e decisões de produto
- `AGENTS.md` — guia operacional do repositório
- `SETUP_COMPLETO.txt` — decisões originais de schema
