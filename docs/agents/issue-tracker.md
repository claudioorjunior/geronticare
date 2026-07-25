# Issue tracker: GitHub

Issues e PRDs deste repo vivem como GitHub issues. Use o `gh` CLI para todas as operações.

## Convenções

- **Criar issue**: `gh issue create --title "..." --body "..."`. Use heredoc para bodies multi-linha.
- **Ler issue**: `gh issue view <number> --comments`, filtrando comentários com `jq` e também buscando labels.
- **Listar issues**: `gh issue list --state open --json number,title,body,labels,comments --jq '[.[] | {number, title, body, labels: [.labels[].name], comments: [.comments[].body]}]'` com filtros `--label` e `--state` apropriados.
- **Comentar em issue**: `gh issue comment <number> --body "..."`
- **Aplicar / remover labels**: `gh issue edit <number> --add-label "..."` / `--remove-label "..."`
- **Fechar**: `gh issue close <number> --comment "..."`

Inferir o repo de `git remote -v` — `gh` faz isso automaticamente rodando dentro de um clone.

## Pull requests as a triage surface

**PRs as a request surface: no.**

Quando alterado para `yes`, PRs passam pelos mesmos labels e estados que issues, usando os equivalentes `gh pr`:

- **Ler PR**: `gh pr view <number> --comments` e `gh pr diff <number>` para o diff.
- **Listar PRs externos para triage**: `gh pr list --state open --json number,title,body,labels,author,authorAssociation,comments` e manter apenas `authorAssociation` de `CONTRIBUTOR`, `FIRST_TIME_CONTRIBUTOR`, ou `NONE` (descartar `OWNER`/`MEMBER`/`COLLABORATOR`).
- **Comentar / label / fechar**: `gh pr comment`, `gh pr edit --add-label`/`--remove-label`, `gh pr close`.

GitHub compartilha um único espaço de numeração entre issues e PRs, então um `#42` pode ser qualquer um — resolver com `gh pr view 42` e fallback para `gh issue view 42`.

## Quando um skill diz "publicar no issue tracker"

Criar uma GitHub issue.

## Quando um skill diz "buscar o ticket relevante"

Rodar `gh issue view <number> --comments`.

## Operações de wayfinding

Usado por `/wayfinder`. O **map** é uma issue única com **child** issues como tickets.

- **Map**: uma issue única com label `wayfinder:map`, contendo o corpo Notes / Decisions-so-far / Fog. `gh issue create --label wayfinder:map`.
- **Child ticket**: uma issue vinculada ao map como GitHub sub-issue (`gh api` no endpoint de sub-issues). Onde sub-issues não estão habilitadas, adicionar o child a uma task list no corpo do map e colocar `Part of #<map>` no topo do corpo do child. Labels: `wayfinder:<type>` (`research`/`prototype`/`grilling`/`task`). Uma vez claimed, o ticket é assignado ao dev responsável.
- **Blocking**: **dependências nativas de issues do GitHub** — a representação canônica visível na UI. Adicionar edge com `gh api --method POST repos/<owner>/<repo>/issues/<child>/dependencies/blocked_by -F issue_id=<blocker-db-id>`, onde `<blocker-db-id>` é o **database id** numérico do blocker (`gh api repos/<owner>/<repo>/issues/<n> --jq .id`, _não_ o `#number` ou `node_id`). GitHub reporta `issue_dependencies_summary.blocked_by` (apenas blockers abertos — o gate ativo). Onde dependências não estiverem disponíveis, fallback para linha `Blocked by: #<n>, #<n>` no topo do corpo do child. Um ticket está desbloqueado quando todo blocker está fechado.
- **Frontier query**: listar os children abertos do map (`gh issue list --state open`, escopo dos sub-issues / task list do map), descartar qualquer um com blocker aberto (`issue_dependencies_summary.blocked_by > 0`, ou issue aberta na linha `Blocked by`) ou com assignee; primeiro na ordem do map vence.
- **Claim**: `gh issue edit <n> --add-assignee @me` — o primeiro write da sessão.
- **Resolve**: `gh issue comment <n> --body "<answer>"`, depois `gh issue close <n>`, depois append de context pointer (gist + link) no Decisions-so-far do map.
