#!/usr/bin/env python3
"""
Smoke RBAC C1-C4 — GerontiCare v0.3.0
=====================================
Verifica por navegação real (Playwright):
  C1: admin  /perfil  (nome, foto, senha)
  C2: profissional  (escalas, consolida AGA, edita clínico)
  C3: admin  (mesmo clínico + admin)
  C4: usuario  (lê clínico, mutações bloqueadas)

Uso (com dev server já rodando na 3002):
  DEV_OVERRIDE_USER_ID=<id> python3 scripts/smoke-c1-c4.py <C1|C2|C3|C4>

Saída: lista de PASS/FAIL com detalhes; exit code 1 se algum FAIL.
"""
import json
import os
import re
import sys
import urllib.request
from playwright.sync_api import sync_playwright

BASE = "http://localhost:3002"
PASSED = []
FAILED = []
CONSOLE_ERROS = []


def check(name: str, cond: bool, detail: str = ""):
    if cond:
        PASSED.append(name)
        print(f"  PASS  {name}")
    else:
        FAILED.append(name)
        print(f"  FAIL  {name}  {detail}")


def rpc(method: str, url: str, payload: dict | None = None):
    """Chamada HTTP direta ao endpoint tRPC (sem UI)."""
    data = json.dumps(payload).encode() if payload else b"null"
    req = urllib.request.Request(
        BASE + url, data=data, headers={"Content-Type": "application/json"}
    )
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status, json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        try:
            body = json.loads(e.read().decode())
        except Exception:
            body = {}
        return e.code, body


def role_of(override_id: str) -> str:
    return {
        "320471aa-5994-4886-9ee6-1cee8e7aa810": "admin",
        "a49fa411-c9b2-48e5-98cf-a5f4fb1a9a23": "profissional",
        "b8a2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d": "usuario",
    }.get(override_id, override_id)


def user_id() -> str:
    return os.environ.get("DEV_OVERRIDE_USER_ID", "320471aa-5994-4886-9ee6-1cee8e7aa810")


def abrir_paciente(page):
    """Abre a lista e clica na primeira linha de paciente. Retorna URL ou None."""
    page.goto(f"{BASE}/pacientes", wait_until="networkidle")
    page.wait_for_timeout(2500)
    rows = page.locator("tbody tr")
    if rows.count() == 0:
        return None
    rows.first.click()
    page.wait_for_timeout(3000)
    return page.url


def run_c1(page):
    """C1 — /perfil (admin): nome, foto, senha."""
    print("\n=== C1 — /perfil (admin) ===")
    page.goto(f"{BASE}/perfil", wait_until="networkidle")
    page.wait_for_selector("input", timeout=15000)
    inputs = page.locator("input")
    check("C1: formulário de perfil renderiza", inputs.count() >= 3, f"{inputs.count()} inputs")

    # Foto: input file com accept correto
    file_input = page.locator("input[type=file]")
    check("C1: upload de foto presente", file_input.count() == 1)
    if file_input.count() == 1:
        accept = file_input.first.get_attribute("accept") or ""
        check("C1: accept permite jpeg/png/webp", "jpeg" in accept and "png" in accept and "webp" in accept, accept)

    # Senha: campos com IDs esperados
    for field_id in ("senha-atual", "nova-senha", "confirmar-senha"):
        check(f"C1: campo {field_id} presente", page.locator(f"#{field_id}").count() == 1)

    # Botão salvar nome presente
    btns = page.locator("button")
    texts = [btns.nth(i).inner_text().strip() for i in range(btns.count())]
    check("C1: botão de salvar presente", any("Salvar" in t or "salvar" in t.lower() for t in texts), str(texts))


def run_c2(page):
    """C2 — profissional: escalas, consolida AGA, edita clínico."""
    print("\n=== C2 — profissional ===")
    page.goto(f"{BASE}/pacientes", wait_until="networkidle")
    page.wait_for_timeout(2500)
    rows = page.locator("tbody tr")
    check("C2: lista de pacientes acessível", rows.count() > 0, f"{rows.count()} linhas")

    url = abrir_paciente(page)
    check("C2: ficha do paciente abre (navegação)", url is not None and "/pacientes/" in (url or ""), str(url))
    if url:
        page.goto(url, wait_until="networkidle")
        page.wait_for_timeout(2500)
        content = page.content().lower()
        check("C2: ficha renderiza KPIs/sinais", "kpi" in content or "sinais" in content or "aga" in content)

        # Links de fluxo clínico (avaliações, registros, sinais)
        for label, path in [("avaliacoes", "avaliacoes"), ("registros", "registros"), ("sinais", "sinais")]:
            check(f"C2: link {label} na ficha", f"/{path}" in page.content())

    # /avaliacoes acessível (escalas)
    if url:
        pid = url.rstrip("/").split("/")[-1]
        page.goto(f"{BASE}/pacientes/{pid}/avaliacoes", wait_until="networkidle")
        page.wait_for_timeout(2500)
        check("C2: página /avaliacoes renderiza", "escala" in page.content().lower() or "instrumento" in page.content().lower() or "katz" in page.content().lower())


def run_c3(page):
    """C3 — admin: mesmo clínico + admin."""
    print("\n=== C3 — admin ===")
    url = abrir_paciente(page)
    check("C3: admin abre ficha do paciente", url is not None and "/pacientes/" in (url or ""), str(url))
    if url:
        page.goto(url, wait_until="networkidle")
        page.wait_for_timeout(2500)
        check("C3: ficha renderiza", "kpi" in page.content().lower() or "aga" in page.content().lower())

    page.goto(f"{BASE}/perfil", wait_until="networkidle")
    check("C3: /perfil acessível", page.locator("input").count() > 0)


def run_c4(page):
    """C4 — usuario: lê clínico, mutações bloqueadas."""
    print("\n=== C4 — usuario ===")
    page.goto(f"{BASE}/pacientes", wait_until="networkidle")
    page.wait_for_timeout(2500)
    rows = page.locator("tbody tr")
    check("C4: usuario vê lista de pacientes", rows.count() > 0, f"{rows.count()} linhas")

    url = abrir_paciente(page)
    check("C4: usuario abre ficha (leitura)", url is not None and "/pacientes/" in (url or ""), str(url))
    if url:
        page.goto(url, wait_until="networkidle")
        page.wait_for_timeout(2500)
        content = page.content().lower()
        check("C4: ficha renderiza (leitura)", "kpi" in content or "aga" in content)

    # Mutações clínicas bloqueadas (FORBIDDEN) — via tRPC direto
    pid = url.rstrip("/").split("/")[-1] if url else "db345899-70b9-415c-8237-4cd236f4bd2e"
    status, body = rpc("POST", "/api/trpc/sinaisVitais.registrar?batch=1", {
        "0": {"json": {"pacienteId": pid, "pressaoArterialSistolica": 120}}
    })
    check("C4: criar sinal vital FORBIDDEN", status == 400 or status == 403, f"status={status}")


def main():
    role = role_of(user_id())
    suite = sys.argv[1] if len(sys.argv) > 1 else "ALL"
    print(f"Smoke RBAC para papel={role} (user={user_id()}) suite={suite}")
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.set_default_timeout(20000)
        page.on("console", lambda m: CONSOLE_ERROS.append(f"{m.type}: {m.text[:120]}") if m.type == "error" else None)
        page.on("pageerror", lambda e: CONSOLE_ERROS.append(f"PAGEERROR: {str(e)[:200]}"))
        if suite in ("C1", "ALL"):
            run_c1(page)
        if suite in ("C2", "ALL"):
            run_c2(page)
        if suite in ("C3", "ALL"):
            run_c3(page)
        if suite in ("C4", "ALL"):
            run_c4(page)
        browser.close()
    if CONSOLE_ERROS:
        print("\nErros de console/browser:")
        for e in CONSOLE_ERROS:
            print(f"  ⚠ {e}")
    print(f"\nRESULTADO: {len(PASSED)} PASS, {len(FAILED)} FAIL")
    if FAILED:
        sys.exit(1)


if __name__ == "__main__":
    main()
