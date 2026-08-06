#!/usr/bin/env python3
"""
Smoke Admin Panel — GerontiCare v0.4.0
======================================
Verifica por navegação real (Playwright) as rotas do painel admin (D1/D3/D4):
  A1: admin — /profissionais (lista, busca, filtro, botão criar)
  A2: admin — /configuracoes (form da instituição + salvar)
  A3: admin — /dashboard (seção Visão Institucional com dados reais)
  A4: usuario — /profissionais e /configuracoes bloqueados ("Acesso restrito")

Uso (com dev server já rodando na 3002, com DEV_OVERRIDE_USER_ID do papel):
  python3 scripts/smoke-v040-admin.py <A1|A2|A3|A4>

Saída: lista de PASS/FAIL com detalhes; exit code 1 se algum FAIL.
"""
import sys
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


def run_a1(page):
    """A1 — /profissionais (admin): lista, busca, filtro papel, botão criar."""
    print("\n=== A1 — /profissionais (admin) ===")
    page.goto(f"{BASE}/profissionais", wait_until="networkidle")
    page.wait_for_timeout(2500)
    content = page.content()

    rows = page.locator("tbody tr")
    check("A1: lista de usuários renderiza", rows.count() >= 3, f"{rows.count()} linhas")

    # Busca
    busca = page.locator("input[type=search]")
    check("A1: campo de busca presente", busca.count() == 1)
    if busca.count() == 1:
        busca.fill("Mock")
        page.wait_for_timeout(1200)
        check("A1: busca filtra resultados", rows.count() >= 1, f"{rows.count()} linhas após busca")
        busca.fill("")
        page.wait_for_timeout(1200)

    # Filtro por papel
    filtro = page.locator("select[aria-label='Filtrar por papel']")
    check("A1: filtro de papel presente", filtro.count() == 1)
    if filtro.count() == 1:
        filtro.select_option("admin")
        page.wait_for_timeout(1200)
        check("A1: filtro por papel funciona", rows.count() >= 1, f"{rows.count()} linhas (admin)")
        filtro.select_option("todos")
        page.wait_for_timeout(1200)

    # Botão "Adicionar usuário"
    btns = page.locator("button")
    texts = [btns.nth(i).inner_text().strip() for i in range(btns.count())]
    check(
        "A1: botão 'Adicionar usuário' presente",
        any("Adicionar usuário" in t for t in texts),
        str(texts[:12]),
    )

    # Dialog de criação abre e tem senha inicial
    criar = page.get_by_role("button", name="Adicionar usuário")
    if criar.count() == 1:
        criar.click()
        page.wait_for_timeout(1000)
        check("A1: dialog de criação abre", page.locator("dialog").count() >= 1)
        check("A1: campo senha inicial presente", page.locator("#uf-senha").count() == 1)
        check("A1: seletor de papel presente", page.locator("#uf-role").count() == 1)
        page.keyboard.press("Escape")
        page.wait_for_timeout(600)

    # Links de navegação ativos (não mais 404)
    check("A1: link Configurações no nav", "/configuracoes" in content)


def run_a2(page):
    """A2 — /configuracoes (admin): form + salvar."""
    print("\n=== A2 — /configuracoes (admin) ===")
    page.goto(f"{BASE}/configuracoes", wait_until="networkidle")
    page.wait_for_timeout(2500)

    for field_id in ("cfg-nome", "cfg-cnpj", "cfg-tel", "cfg-email"):
        check(f"A2: campo {field_id} presente", page.locator(f"#{field_id}").count() == 1)
    for field_id in ("cfg-log", "cfg-num", "cfg-bairro", "cfg-cidade", "cfg-cep"):
        check(f"A2: campo endereço {field_id} presente", page.locator(f"#{field_id}").count() == 1)

    nome = page.locator("#cfg-nome")
    valor_inicial = nome.input_value() if nome.count() == 1 else ""
    check("A2: nome da instituição carregado", len(valor_inicial) > 0, valor_inicial)

    # Salvar (sem alterar valor → idempotente)
    btn_salvar = page.get_by_role("button", name="Salvar alterações")
    check("A2: botão salvar presente", btn_salvar.count() >= 1)
    if btn_salvar.count() >= 1:
        btn_salvar.first.click()
        page.wait_for_timeout(2000)
        check("A2: feedback de sucesso após salvar", "salvos com sucesso" in page.content())


def run_a3(page):
    """A3 — /dashboard (admin): seção Visão Institucional com dados reais."""
    print("\n=== A3 — /dashboard (admin) — métricas institucionais ===")
    page.goto(f"{BASE}/dashboard", wait_until="networkidle")
    page.wait_for_timeout(2500)
    content = page.content()

    check("A3: seção Visão Institucional presente", "Visão Institucional" in content)
    check("A3: card Equipe ativa presente", "Equipe ativa" in content)
    check("A3: card AGAs concluídas presente", "AGAs concluídas" in content)
    check("A3: card AGAs pendentes presente", "AGAs pendentes" in content)
    check("A3: card Sinais vitais no mês presente", "Sinais vitais no mês" in content)

    # Dados reais: equipe ativa do seed tem >= 3 usuários (admin+profissional+leitor)
    cards = page.locator("section[aria-label='Métricas institucionais'] div.rounded-xl")
    if cards.count() >= 1:
        equipe_texto = cards.first.inner_text()
        import re
        # Pega todos os números do card; o primeiro número após o label é o total
        todos_numeros = re.findall(r"\d+", equipe_texto)
        total = int(todos_numeros[0]) if todos_numeros else 0
        check("A3: equipe ativa >= 3 (seed)", total >= 3, equipe_texto.replace("\n", " | "))


def run_a4(page):
    """A4 — usuario (leitura): rotas admin bloqueadas."""
    print("\n=== A4 — usuario (leitura) ===")
    page.goto(f"{BASE}/profissionais", wait_until="networkidle")
    page.wait_for_timeout(2500)
    check("A4: /profissionais bloqueado para leitura", "Acesso restrito" in page.content(), page.title())

    page.goto(f"{BASE}/configuracoes", wait_until="networkidle")
    page.wait_for_timeout(2500)
    check("A4: /configuracoes bloqueado para leitura", "Acesso restrito" in page.content(), page.title())

    # Dashboard não mostra métricas institucionais para leitura
    page.goto(f"{BASE}/dashboard", wait_until="networkidle")
    page.wait_for_timeout(2500)
    check("A4: Visão Institucional ausente para leitura", "Visão Institucional" not in page.content())


def main():
    suite = sys.argv[1] if len(sys.argv) > 1 else "ALL"
    print(f"Smoke Admin Panel v0.4.0 — suite={suite}")
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.set_default_timeout(20000)
        page.on("console", lambda m: CONSOLE_ERROS.append(f"{m.type}: {m.text[:120]}") if m.type == "error" else None)
        page.on("pageerror", lambda e: CONSOLE_ERROS.append(f"PAGEERROR: {str(e)[:200]}"))
        if suite in ("A1", "ALL"):
            run_a1(page)
        if suite in ("A2", "ALL"):
            run_a2(page)
        if suite in ("A3", "ALL"):
            run_a3(page)
        if suite in ("A4", "ALL"):
            run_a4(page)
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
