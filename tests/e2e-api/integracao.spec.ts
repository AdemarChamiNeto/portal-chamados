import { expect, test, type Browser, type Page } from "@playwright/test";
import { codeForStep, stepAt } from "../../src/lib/totp";

// Portal + API PHP de verdade (MySQL). Cada teste cria os próprios dados: o seed da API não é igual ao do modo demonstração.
async function entrar(page: Page, email: string) {
  await page.goto("/chamados");
  await expect(page).toHaveURL(/\/login/);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Senha").fill("senha-demo-123");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByRole("heading", { name: "Chamados", level: 1 })).toBeVisible();
}

async function novaSessao(browser: Browser, email: string) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await entrar(page, email);
  return { ctx, page };
}

test("senha errada volta o erro da API e não entra", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("bruno@exemplo.com");
  await page.getByLabel("Senha").fill("errada");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Email ou senha" })).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
});

test("chamado do começo ao atendimento: comentário interno fica com a equipe e outro solicitante não vê", async ({ browser }) => {
  const titulo = `Outlook não sincroniza ${Date.now()}`;

  const diego = await novaSessao(browser, "diego@exemplo.com");
  await diego.page.getByRole("link", { name: "+ Abrir chamado" }).click();
  await diego.page.getByRole("textbox", { name: "Título" }).fill(titulo);
  await diego.page.getByRole("textbox", { name: "Descrição" }).fill("O Outlook mostra Desconectado e não baixa e-mails novos.");
  await diego.page.getByRole("combobox", { name: "Categoria" }).selectOption("software");
  await diego.page.getByRole("radio", { name: /^Alto/ }).check();
  await diego.page.getByRole("radio", { name: /^Média/ }).check();
  await diego.page.getByRole("button", { name: "Abrir chamado" }).click();
  await expect(diego.page.getByRole("status").filter({ hasText: "Chamado aberto" })).toBeVisible();
  await expect(diego.page.getByRole("heading", { name: titulo })).toBeVisible();
  const url = diego.page.url().replace(/\?.*$/, "");

  const bruno = await novaSessao(browser, "bruno@exemplo.com");
  await bruno.page.goto(url);
  await bruno.page.getByRole("button", { name: "Assumir o chamado" }).click();
  await expect(bruno.page.getByRole("button", { name: "Largar o chamado" })).toBeVisible();
  await bruno.page.getByRole("textbox", { name: "Comentar" }).fill("Perfil do Outlook corrompido, recriar.");
  await bruno.page.getByLabel(/Comentário interno/).check();
  await bruno.page.getByRole("button", { name: "Enviar" }).click();
  await expect(bruno.page.getByText("Perfil do Outlook corrompido, recriar.")).toBeVisible();
  await bruno.page.getByRole("textbox", { name: "Comentar" }).fill("Pode fechar e abrir o Outlook?");
  await bruno.page.getByRole("button", { name: "Enviar" }).click();
  await expect(bruno.page.getByText("Pode fechar e abrir o Outlook?")).toBeVisible();
  await bruno.page.getByRole("button", { name: "Atender" }).click();
  await expect(bruno.page.getByText("Em atendimento").first()).toBeVisible();

  await diego.page.goto(url);
  await expect(diego.page.getByText("Pode fechar e abrir o Outlook?")).toBeVisible();
  await expect(diego.page.getByText("Perfil do Outlook corrompido, recriar.")).toHaveCount(0);
  await expect(diego.page.getByText("Em atendimento").first()).toBeVisible();

  const elisa = await novaSessao(browser, "elisa@exemplo.com");
  await elisa.page.goto(url);
  await expect(elisa.page.getByRole("heading", { name: "Não encontrado" })).toBeVisible();

  await Promise.all([diego.ctx.close(), bruno.ctx.close(), elisa.ctx.close()]);
});

test("token recusado pela API manda para o login", async ({ page, context }) => {
  await context.addCookies([{ name: "chamados_session", value: "token-invalido", url: "http://localhost:3220" }]);
  await page.goto("/chamados");
  await expect(page).toHaveURL(/\/login\?expirou=1/);
});

test("2FA: ativar, código repetido recusado e código de recuperação vale uma vez", async ({ page }) => {
  await entrar(page, "fabio@exemplo.com");
  await page.getByRole("link", { name: "Minha conta" }).click();
  await page.getByRole("button", { name: "Ativar verificação em duas etapas" }).click();
  const secret = (await page.locator("code").first().textContent())!.replace(/\s/g, "");
  const step = stepAt(new Date());
  await page.getByRole("textbox", { name: /Digite o código de 6 dígitos/ }).fill(codeForStep(secret, step));
  await page.getByRole("button", { name: "Confirmar e ativar" }).click();
  await expect(page.getByRole("status").filter({ hasText: "ativada" })).toBeVisible();
  const recuperacao = (await page.getByRole("list", { name: "Códigos de recuperação" }).getByRole("listitem").first().textContent())!.trim();

  const passoDoCodigo = async (codigo: string) => {
    await page.getByRole("button", { name: "Sair" }).click();
    await expect(page).toHaveURL(/\/login/);
    await page.goto("/chamados");
    await page.getByLabel("Email").fill("fabio@exemplo.com");
    await page.getByLabel("Senha").fill("senha-demo-123");
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).toHaveURL(/\/login\/codigo/);
    await page.getByRole("textbox", { name: "Código" }).fill(codigo);
    await page.getByRole("button", { name: "Entrar" }).click();
  };
  const entrou = () => expect(page.getByRole("heading", { name: "Chamados", level: 1 })).toBeVisible();
  const recusado = () => expect(page.getByRole("alert").filter({ hasText: "Código inválido" })).toBeVisible();

  // a API guarda o último passo usado: o mesmo código da ativação não entra de novo
  await passoDoCodigo(codeForStep(secret, step));
  await recusado();
  await page.getByRole("textbox", { name: "Código" }).fill(codeForStep(secret, step + 1));
  await page.getByRole("button", { name: "Entrar" }).click();
  await entrou();

  await passoDoCodigo(recuperacao);
  await entrou();
  await passoDoCodigo(recuperacao);
  await recusado();
});
