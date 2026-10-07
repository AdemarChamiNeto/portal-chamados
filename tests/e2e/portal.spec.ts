import { expect, test, type Page } from "@playwright/test";

// Com Cache Components, a rota anterior fica no DOM escondida (<Activity>); por isso os seletores usam
// getByRole, que ignora elementos invisíveis (getByLabel/getByText achariam os dois).
async function entrar(page: Page, email: string) {
  await page.goto("/chamados");
  await expect(page).toHaveURL(/\/login\?voltar=%2Fchamados/);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Senha").fill("senha-demo-123");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByRole("heading", { name: "Chamados", level: 1 })).toBeVisible();
}

test("login inválido mostra erro e não entra", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("bruno@exemplo.com");
  await page.getByLabel("Senha").fill("errada");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Email ou senha" })).toHaveText("Email ou senha incorretos");
  await expect(page).toHaveURL(/\/login/);
});

test("solicitante abre um chamado com prioridade calculada", async ({ page }) => {
  await entrar(page, "diego@exemplo.com");
  await expect(page.getByRole("link", { name: "Indicadores" })).toHaveCount(0);
  await page.getByRole("link", { name: "+ Abrir chamado" }).click();

  await page.getByRole("button", { name: "Abrir chamado" }).click();
  await expect(page.getByText("Mínimo de 5 caracteres")).toBeVisible(); // validação no servidor

  await page.getByRole("textbox", { name: "Título" }).fill("Monitor piscando");
  await page.getByRole("textbox", { name: "Descrição" }).fill("O monitor apaga e acende a cada poucos minutos.");
  await page.getByRole("combobox", { name: "Categoria" }).selectOption("hardware");
  await page.getByRole("radio", { name: /^Médio/ }).check();
  await page.getByRole("radio", { name: /^Alta/ }).check();
  await expect(page.getByTestId("previa-prioridade")).toContainText("Alta");
  await page.getByRole("button", { name: "Abrir chamado" }).click();

  await expect(page.getByRole("status").filter({ hasText: "Chamado aberto" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Monitor piscando" })).toBeVisible();
});

test("técnico assume, atende e resolve com nota", async ({ page }) => {
  await entrar(page, "bruno@exemplo.com");
  await page.getByRole("link", { name: "Mouse com clique duplo falhando" }).click();
  await expect(page.getByRole("heading", { name: "Mouse com clique duplo falhando" })).toBeVisible();

  await page.getByRole("button", { name: "Assumir o chamado" }).click();
  await expect(page.getByRole("button", { name: "Largar o chamado" })).toBeVisible();

  await page.getByRole("button", { name: "Atender" }).click();
  await expect(page.getByText("Em atendimento").first()).toBeVisible();

  await page.getByLabel("Novo status").selectOption("resolvido");
  await page.getByLabel(/Nota/).fill("Mouse trocado por um novo.");
  await page.getByRole("button", { name: "Resolver" }).click();
  await expect(page.getByText("Mouse trocado por um novo.").first()).toBeVisible();
  await expect(page.getByLabel("Novo status")).toHaveValue("em_atendimento"); // opções de "resolvido": reabrir ou fechar
});

test("comentário interno não aparece para o solicitante", async ({ page, browser }) => {
  await entrar(page, "carla@exemplo.com");
  await page.getByRole("link", { name: "Impressora do RH imprimindo manchado" }).click();
  await page.getByRole("textbox", { name: "Comentar" }).fill("Toner provavelmente no fim.");
  await page.getByLabel(/Comentário interno/).check();
  await page.getByRole("button", { name: "Enviar" }).click();
  await expect(page.getByText("Toner provavelmente no fim.")).toBeVisible();
  const url = page.url();

  const outra = await browser.newContext();
  const elisa = await outra.newPage();
  await entrar(elisa, "elisa@exemplo.com");
  await elisa.goto(url);
  await expect(elisa.getByRole("heading", { name: "Impressora do RH imprimindo manchado" })).toBeVisible();
  await expect(elisa.getByText("Toner provavelmente no fim.")).toHaveCount(0);
  await outra.close();
});

test("filtros ficam na URL e indicadores carregam para a equipe", async ({ page }) => {
  await entrar(page, "admin@exemplo.com");
  await page.getByRole("combobox", { name: "Prioridade" }).selectOption("critica");
  await expect(page).toHaveURL(/prioridade=critica/);
  await expect(page.getByRole("link", { name: "Sistema de vendas fora do ar para a equipe" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Mouse com clique duplo falhando" })).toHaveCount(0);

  await page.getByRole("link", { name: "Indicadores" }).click();
  await expect(page.getByRole("heading", { name: "Indicadores" })).toBeVisible();
  await expect(page.getByText("Atrasados", { exact: true })).toBeVisible();
});

test("volta para a página pedida depois do login; sessão inválida pede login de novo", async ({ page, context }) => {
  await page.goto("/indicadores");
  await expect(page).toHaveURL(/\/login\?voltar=%2Findicadores/);
  await page.getByLabel("Email").fill("carla@exemplo.com");
  await page.getByLabel("Senha").fill("senha-demo-123");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByRole("heading", { name: "Indicadores" })).toBeVisible();

  await context.clearCookies();
  await context.addCookies([{ name: "chamados_session", value: "token-invalido", url: "http://localhost:3210" }]);
  await page.goto("/chamados");
  await expect(page).toHaveURL(/\/login\?expirou=1/);
  await expect(page.getByRole("status").filter({ hasText: "Sua sessão expirou" })).toBeVisible();
});
