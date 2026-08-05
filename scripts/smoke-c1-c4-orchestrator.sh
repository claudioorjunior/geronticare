#!/usr/bin/env bash
# Smoke RBAC C1-C4 — orquestrador
# Sobe o dev server com DEV_OVERRIDE_USER_ID de cada papel, roda o smoke e derruba.
set -euo pipefail

cd "$(dirname "$0")/.."
PORT=3002
LOG=/tmp/geronticare-smoke-role.log

# papel:uid:suites — lista simples para evitar problemas com arrays associativos
ROLES=(
  "admin|320471aa-5994-4886-9ee6-1cee8e7aa810|C1 C3"
  "profissional|a49fa411-c9b2-48e5-98cf-a5f4fb1a9a23|C2"
  "usuario|b8a2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d|C4"
)

cleanup() {
  kill "$SERVER_PID" 2>/dev/null || true
  wait "$SERVER_PID" 2>/dev/null || true
}

trap cleanup EXIT

overall=0
for entry in "${ROLES[@]}"; do
  IFS='|' read -r role uid suites <<< "$entry"
  echo "════════════════════════════════════════════════"
  echo "PAPEL: $role (DEV_OVERRIDE_USER_ID=$uid)"
  echo "════════════════════════════════════════════════"

  # Garante porta livre
  lsof -tiTCP:$PORT -sTCP:LISTEN 2>/dev/null | xargs -r kill 2>/dev/null || true
  sleep 2

  DEV_OVERRIDE_USER_ID="$uid" npm run dev -- --webpack -p "$PORT" > "$LOG" 2>&1 &
  SERVER_PID=$!

  # Espera health
  ok=0
  for i in $(seq 1 30); do
    if curl -sf "http://localhost:$PORT/api/health" >/dev/null 2>&1; then ok=1; break; fi
    sleep 2
  done
  if [ "$ok" != 1 ]; then
    echo "ERRO: dev server não subiu para papel $role"
    tail -20 "$LOG"
    overall=1
    continue
  fi

  for suite in $suites; do
    if DEV_OVERRIDE_USER_ID="$uid" python3 scripts/smoke-c1-c4.py "$suite"; then
      echo "✓ suite $suite (papel $role) OK"
    else
      echo "✗ suite $suite (papel $role) FALHOU"
      overall=1
    fi
  done

  kill "$SERVER_PID" 2>/dev/null || true
  wait "$SERVER_PID" 2>/dev/null || true
  lsof -tiTCP:$PORT -sTCP:LISTEN 2>/dev/null | xargs -r kill 2>/dev/null || true
  sleep 2
done

echo ""
if [ "$overall" = 0 ]; then
  echo "SMOKE C1-C4 COMPLETO: TODOS PASS"
else
  echo "SMOKE C1-C4: HOUVE FALHAS"
fi
exit "$overall"
