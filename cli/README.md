# geronticare

Instalador self-hosted do GerontiCare. Requer **Node 22**.

## Uso

```bash
npx geronticare@latest
```

Instala (ou retoma) uma instalação incompleta e inicia o servidor em foreground.

```bash
npx geronticare@latest start
```

Inicia uma instalação pronta, sem reconfigurar banco nem baixar release.

```bash
npx geronticare@latest doctor
```

Diagnóstico somente leitura: permissões, lock, release, porta, processo, banco,
migrations e estado do bootstrap.

## Armazenamento

O diretório persistente segue o padrão do sistema, ou pode ser sobrescrito com
`GERONTICARE_HOME` (usado em testes e instalações customizadas):

| Sistema | Root |
|---|---|
| macOS | `~/Library/Application Support/GerontiCare` |
| Linux | `${XDG_DATA_HOME:-~/.local/share}/geronticare` |
| Windows | `%LOCALAPPDATA%\GerontiCare` |

Segredos (`DATABASE_URL`, `AUTH_SECRET`, `SETUP_TOKEN`) ficam em `secrets.json`
com permissões restritas e são injetados diretamente no processo do servidor —
nunca em `.env`, argumentos ou logs.

## Banco de dados

Na instalação, a CLI pergunta onde armazenar os dados:

- **Banco de dados local** — PostgreSQL instalado e executado neste computador.
- **Banco de dados na nuvem (gerenciado)** — Neon ou Supabase.

Em Linux, o modo local exige PostgreSQL 16. Em Ubuntu/Debian, após a confirmação
do usuário, a CLI configura o repositório oficial PostgreSQL quando necessário,
verifica o candidato assinado e só então instala `postgresql-16`; se a fonte não
oferecer a versão 16, a instalação permanece em `PREFLIGHT` para permitir Neon
ou Supabase.

## Desenvolvimento

```bash
node --test   # testes nativos (Node 22)
```

O CLI é um pacote JavaScript ESM independente do aplicativo TypeScript; a
checagem do pacote é feita por ESLint e `node --check` no CI, além dos testes
nativos acima.
