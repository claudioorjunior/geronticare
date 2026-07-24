# GerontiCare M4 — UI Dashboard e Sistema de Navegação

Plano de implementação da interface do usuário (M4) para GerontiCare v0.1.0, com sistema de papéis (admin/profissional/usuário), menu lateral de navegação com busca global de pacientes, e dashboard mínimo por papel.

## 1. Decisões do Grilling (consolidadas)

### 1.1 Papéis de acesso (3)
- **Admin** — acesso total: instituição, usuários, pacientes, clínicos, anexos
- **Profissional** — acesso clínico completo: pacientes, AGA, registros, sinais vitais, anexos. Não gerencia usuários/instituição
- **Usuário** — acesso cadastral apenas: pacientes (ler/editar dados pessoais), perfil próprio. **Não acessa** AGA, registros clínicos, sinais vitais, anexos

### 1.2 Fluxo de primeiro acesso
- Registro self-service: cria instituição + vira admin automaticamente
- Admin cria outros usuários definindo papel e especialidade

### 1.3 Dashboard — mínimo funcional, evolutivo
- **Admin**: cards (pacientes ativos, profissionais, admissões recentes)
- **Profissional**: "Meus atendimentos hoje" (registros criados hoje pelo usuário)
- **Usuário**: redireciona direto para lista de pacientes
- Sem endpoint de agregação novo — usa contagem client-side dos endpoints existentes

### 1.4 Navegação — híbrida: Top Nav Global + Tabs Locais no prontuário
- **Top nav (fixa)**: Logo | Dashboard | Pacientes | [Busca global de pacientes com dropdown rápido] | Perfil do usuário (avatar + nome + papel)
- **Busca global**: input compacto na top nav; digita nome/CNo/CPF → dropdown com resultado → clique leva direto ao perfil do paciente; visível em qualquer tela, inclusive dentro do prontuário
- **Perfil do paciente (hub)**: header com foto, nome e idade + tabs locais abaixo (`Dados | AGA | Registros | Sinais | Anexos`); cada tab carrega conteúdo via Suspense (lazy); sem sidebar lateral ocupando espaço
- **Menu adaptativo por papel**: `admin` vê link Usuários e Instituição na top nav; `profissional` não vê; `usuário` vê só Dashboard e Pacientes; itens clínicos (AGA, Registros, Sinais) ocultos via middleware `clinicalProcedure` quando o papel é `usuario`
- **Racional**: top nav libera 100% da largura horizontal para conteúdo clínico (tabelas, formulários, gráficos Recharts); tabs locais no conteúdo evitam confusão com navegação global; busca persistente sem competir com conteúdo; modelo evolutivo — novas seções (Agenda, Financeiro) adicionam na top nav sem redesenhar layout
- **Referência**: padrão usado em Epic MyChart (top nav global + tabs no paciente record), OpenMRS (header do paciente + tabs de conteúdo), GitHub Issues (nav global + tabs locais no conteúdo)

### 1.5 Paleta visual
- Base: slate/zinc (neutro clínico)
- Accent primário: teal-600 (#0d9488) — remete a saúde
- Accent secundário: blue-600 — ações primárias
- Fundo: slate-50 / white
- Fonte: Geist Sans (já no projeto) — sem mudança
- Sem emojis, text-sm mínimo, lucide icons

### 1.6 Stack UI
- shadcn/ui (instalar via CLI)
- Recharts 3.x via shadcn chart components
- Lucide React para ícones
- Tailwind CSS 4 (já instalado)

---

## 2. Mudanças no Schema e Backend

### 2.1 Schema — adicionar `role` em usuarios
```
role: enum('admin', 'profissional', 'usuario').default('profissional')
```
Geração de migration via drizzle-kit.

### 2.2 Middleware tRPC — 3 níveis
- `protectedProcedure` — qualquer autenticado (dados básicos)
- `clinicalProcedure` — admin + profissional (dados clínicos)
- `adminProcedure` — só admin (gestão de usuários/instituição)

Aplicar em cada router conforme sensibilidade dos dados.

### 2.3 Better-Auth — configurar
- Criar auth client em lib/auth/
- Configurar session cookies
- Middleware Next.js para proteger rotas /dashboard/*

### 2.4 Router dashboard (novo — opcional, pode ser client-side)
Se decidir por agregação server-side futuramente.

---

## 3. Estrutura de Arquivos (App Router)

```
app/
  layout.tsx              # já existe — adicionar AuthProvider
  providers.tsx           # já existe — adicionar AuthContext
  page.tsx               # redireciona para /dashboard se auth, senão /login
  login/page.tsx        # formulário login/registro
  dashboard/
    layout.tsx           # TopNav + conteúdo principal (sem sidebar)
    page.tsx            # Dashboard por papel
  pacientes/
    page.tsx            # Lista com busca/filtros
    [id]/
      layout.tsx        # Header paciente + Tabs locais (Dados/AGA/Registros/Sinais/Anexos)
      page.tsx          # Tab Dados (default)
      edit/page.tsx    # Formulário edição dados cadastrais
      aga/
        page.tsx        # Lista de AGAs
        nova/page.tsx  # Formulário nova AGA
      registros/
        page.tsx        # Timeline unificada
        novo/page.tsx  # Formulário novo registro
      sinais/
        page.tsx        # Lista + gráfico tendências
        novo/page.tsx  # Formulário novo sinal vital
  usuarios/
    page.tsx            # Lista (só admin vê)
    novo/page.tsx      # Formulário criar (só admin)
  instituicao/
    page.tsx            # Dados da instituição
lib/
  auth/                # better-auth config + client
  trpc/
    server.ts          # adicionar role ao contexto
    middleware.ts      # adminProcedure, clinicalProcedure
  components/
    ui/                # shadcn components
    sidebar.tsx       # AppSidebar customizado
    patient-search.tsx # Busca global de pacientes
    dashboard-cards.tsx
```

---

## 4. Cronograma de Implementação (fases)

### Fase 1 — Fundação (dependências + auth + schema)
1. Instalar shadcn/ui, lucide-react, recharts 3, @radix-ui/*
2. Adicionar `role` ao schema + migration
3. Configurar Better-Auth (client + server + middleware Next)
4. Atualizar tRPC context com `role` e criar middlewares
5. Criar componentes base: Sidebar, PatientSearch, AuthGuard

### Fase 2 — Layout e Navegação
6. Dashboard layout com sidebar adaptativa
7. Página de login/registro
8. Redirecionamento de page.tsx
9. Busca global de pacientes na sidebar

### Fase 3 — Telas de Gestão (admin)
10. Lista e formulário de usuários (com role/especialidade)
11. Página da instituição

### Fase 4 — Pacientes e Perfil Hub
12. Lista de pacientes com filtros
13. Perfil do paciente — layout com tabs (Dados | AGA | Registros | Sinais | Anexos)
14. Formulário edição de paciente (restrito por role)

### Fase 5 — Clínico (AGA, Registros, Sinais)
15. Formulário AGA com 6 escalas e auto-interpretação
16. Timeline de registros
17. Formulário e gráfico de sinais vitais
18. Upload de anexos (quando router existir)

### Fase 6 — Dashboard e Polimento
19. Cards de dashboard por papel
20. Teste de permissão em cada rota
21. Build e type-check

---

## 5. Riscos e Mitigações

| Risco | Mitigação |
|---|---|
| Better-Auth config complexa | Seguir docs oficiais; testar login em runtime antes de prosseguir |
| shadcn/ui + Tailwind v4 conflito | Usar CLI shadcn com --tailwind-4 flag; testar build após cada componente |
| Recharts 3 incompatível | Já validado pelo subagente — peerDep resolvido nativamente |
| Permissões client-side burláveis | Sempre validar role no server (tRPC middleware); client é só UI |
| Perfil do paciente muito pesado | Carregar tabs com lazy/Suspense; não renderizar tudo de uma vez |
| Sem endpoint de dashboard | Usar contagem client-side dos dados já carregados |

---

## 6. Verificação de Sucesso

- [ ] `npm run build` passa sem erros
- [ ] `npm run type-check` limpo
- [ ] Login funciona em runtime (não só type-check)
- [ ] Admin consegue criar usuário com cada um dos 3 papéis
- [ ] Profissional acessa AGA; usuário recebe erro/ocultação
- [ ] Busca na sidebar encontra paciente e navega para perfil
- [ ] Perfil do paciente mostra tabs corretas conforme papel
- [ ] Dashboard renderiza cards diferentes por papel

---

## 7. Arquivos de Referência dos Subagentes

- `/Users/claudio/Documents/geronticare/INVENTARIO_TELAS_M4.md` — mapeamento completo de 12 telas
- `/Users/claudio/Documents/comparativo-graficos-geronticare.md` — comparação Recharts/Tremor
- `/Users/claudio/Documents/geronticare-referencias.md` — padrões visuais EHR
