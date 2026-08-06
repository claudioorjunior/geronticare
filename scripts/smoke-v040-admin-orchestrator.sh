#!/usr/bin/env bash
# Smoke Admin Panel v0.4.0 — orquestrador
# Sobe o dev server com DEV_OVERRIDE_USER_ID de cada papel, roda o smoke e derruba.
# Padrão do smoke-c1-c4-orchestrator.sh.
set -euo pipefail

cd "$(dirname "$0")/.."
PORT=3002
LOG=/tmp/geronticare-smoke-v040.log

ROLES=(
  "admin|320471aa-5994-4886-9ee6-1cee8e7aa810|A1 A2 A3"
  "usuario|b8a2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d|A4"
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

  lsof -tiTCP:$PORT -sTCP:LISTEN 2>/dev/null | xargs -r kill 2>/dev/null || true
  sleep 2

  DEV_OVERRIDE_USER_ID="$uid" npm run dev -- --webpack -p "$PORT" > "$LOG" 2>&1 &
  SERVER_PID=$!

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
    if python3 scripts/smoke-v040-admin.py "$suite"; then
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
  echo "SMOKE V0.4.0 COMPLETO: TODOS PASS"
else
  echo "SMOKE V0.4.0: HOUVE FALHAS"
fi
exit "$overall"
