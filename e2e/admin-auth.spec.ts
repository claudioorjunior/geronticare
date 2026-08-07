import { expect, test, type BrowserContext } from '@playwright/test';

async function autenticarComoAdminDev(context: BrowserContext) {
  await context.addCookies([
    {
      name: 'better-auth.session_token',
      value: 'dev-bypass-e2e',
      url: 'http://127.0.0.1:3100',
      httpOnly: true,
      sameSite: 'Lax',
    },
  ]);
}

test('rota autenticada redireciona para login e preserva o destino', async ({ page }) => {
  await page.goto('/dashboard');

  await expect(page).toHaveURL(/\/login\?callbackUrl=%2Fdashboard$/);
  await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible();
});

test('usuário com cookie não permanece na tela de login', async ({ context, page }) => {
  await autenticarComoAdminDev(context);
  await page.goto('/login');

  await expect(page).toHaveURL(/\/dashboard$/);
});

test('admin cria profissional sem especialidade', async ({ context, page }) => {
  await autenticarComoAdminDev(context);
  await page.goto('/profissionais');
  await expect(page.getByRole('heading', { name: 'Usuários' })).toBeVisible();

  await page.getByRole('button', { name: 'Adicionar usuário' }).click();
  await page.getByLabel('Nome completo').fill('Profissional E2E');
  await page
    .getByRole('textbox', { name: /^E-mail/ })
    .fill(`profissional-e2e-${Date.now()}@mock.ilpi`);
  await page.getByLabel('Senha inicial').fill('senha-e2e-segura');
  await page.getByLabel('Papel', { exact: true }).selectOption('profissional');
  await page.getByLabel('Especialidade').selectOption('');
  await page.getByRole('button', { name: 'Adicionar', exact: true }).click();

  await expect(page.getByText('Profissional E2E', { exact: true })).toBeVisible();
});
