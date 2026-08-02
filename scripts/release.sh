#!/usr/bin/env bash
#
# Fluxo de release do GerontiCare.
#
# Uso: ./scripts/release.sh <versao>
# Exemplo: ./scripts/release.sh 0.3.0
#
# O que faz:
#   1. Valida que a working tree está limpa e que a versão é semver.
#   2. Roda verificações locais (lint, type-check, testes).
#   3. Atualiza a versão no package.json.
#   4. Troca "## [X.Y.Z] - Não lançado" pela data de hoje no CHANGELOG.md.
#   5. Cria commit "chore(release): vX.Y.Z" e tag anotada "vX.Y.Z".
#
# Depois, revise e rode:
#   git push origin main --follow-tags
# O workflow .github/workflows/release.yml cria a GitHub Release.

set -euo pipefail

VERSION="${1:-}"

if [[ -z "$VERSION" ]]; then
  echo "Uso: ./scripts/release.sh <versao>  (ex.: 0.3.0)" >&2
  exit 1
fi

if ! [[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "Erro: versão inválida '$VERSION'. Use o formato X.Y.Z (semver)." >&2
  exit 1
fi

TAG="v$VERSION"

if git rev-parse "$TAG" >/dev/null 2>&1; then
  echo "Erro: a tag $TAG já existe." >&2
  exit 1
fi

if [[ -n "$(git status --porcelain)" ]]; then
  echo "Erro: working tree suja. Faça commit ou stash antes do release." >&2
  exit 1
fi

if ! grep -q "## \[$VERSION\]" CHANGELOG.md; then
  echo "Erro: CHANGELOG.md não tem a seção '## [$VERSION]'. Adicione antes do release." >&2
  exit 1
fi

echo "==> Rodando verificações (lint, type-check, testes)..."
npm run lint
npm run type-check
npm test

echo "==> Atualizando package.json para $VERSION..."
npm version "$VERSION" --no-git-tag-version >/dev/null

echo "==> Fixando data no CHANGELOG.md..."
TODAY="$(date +%Y-%m-%d)"
sed -i.bak "s/## \[$VERSION\] - Não lançado/## [$VERSION] - $TODAY/" CHANGELOG.md
rm -f CHANGELOG.md.bak

echo "==> Criando commit e tag $TAG..."
git add package.json package-lock.json CHANGELOG.md
git commit -m "chore(release): $TAG"
git tag -a "$TAG" -m "GerontiCare $TAG"

echo ""
echo "Release $TAG preparado localmente."
echo "Revise com: git show $TAG"
echo "Publique com: git push origin HEAD --follow-tags"
