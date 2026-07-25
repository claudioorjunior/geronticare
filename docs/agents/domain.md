# Domain Docs

Como os skills de engenharia devem consumir a documentação de domínio deste repo ao explorar o codebase.

## Antes de explorar, leia estes

- **`CONTEXT.md`** na raiz do repo, ou
- **`CONTEXT-MAP.md`** na raiz do repo se existir — ele aponta para um `CONTEXT.md` por contexto. Leia cada um relevante ao tópico.
- **`docs/adr/`** — leia ADRs que tocam a área onde você vai trabalhar. Em repos multi-context, verifique também `src/<context>/docs/adr/` para decisões com escopo de contexto.

Se algum desses arquivos não existir, **prossiga silenciosamente**. Não sinalize a ausência; não sugira criá-los de antemão. O skill `/domain-modeling` (acessível via `/grill-with-docs` e `/improve-codebase-architecture`) os cria sob demanda quando termos ou decisões são de fato resolvidos.

## Estrutura de arquivos

Single-context repo (maioria dos repos):

```
/
├── CONTEXT.md
├── docs/adr/
│   ├── 0001-event-sourced-orders.md
│   └── 0002-postgres-for-write-model.md
└── src/
```

Multi-context repo (presença de `CONTEXT-MAP.md` na raiz):

```
/
├── CONTEXT-MAP.md
├── docs/adr/                          ← decisões de sistema
└── src/
    ├── ordering/
    │   ├── CONTEXT.md
    │   └── docs/adr/                  ← decisões específicas do contexto
    └── billing/
        ├── CONTEXT.md
        └── docs/adr/
```

## Use o vocabulário do glossário

Quando seu output nomear um conceito de domínio (em título de issue, proposta de refactor, hipótese, nome de teste), use o termo como definido em `CONTEXT.md`. Não derive para sinônimos que o glossário explicitamente evita.

Se o conceito que você precisa não está no glossário ainda, isso é um sinal — ou você está inventando linguagem que o projeto não usa (reconsidere) ou há uma lacuna real (anote para `/domain-modeling`).

## Sinalize conflitos de ADR

Se seu output contradisser um ADR existente, evidencie isso explicitamente em vez de sobrescrever silenciosamente:

> _Contradiz ADR-0007 (event-sourced orders) — mas vale reabrir porque…_
