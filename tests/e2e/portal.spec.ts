import { expect, test, type Page } from "@playwright/test";
import { codeForStep, stepAt } from "../../src/lib/totp";

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

test("voltar malicioso no login não leva para outro site", async ({ page }) => {
  await page.goto("/login?voltar=" + encodeURIComponent(String.raw`/\site-falso.example`));
  await page.getByLabel("Email").fill("bruno@exemplo.com");
  await page.getByLabel("Senha").fill("senha-demo-123");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByRole("heading", { name: "Chamados", level: 1 })).toBeVisible();
  expect(new URL(page.url()).host).toBe(`localhost:3210`);
});

test("respostas trazem os cabeçalhos de segurança", async ({ request }) => {
  const res = await request.get("/login");
  const h = res.headers();
  expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(h["content-security-policy"]).toContain("object-src 'none'");
  expect(h["x-content-type-options"]).toBe("nosniff");
  expect(h["x-frame-options"]).toBe("DENY");
  expect(h["x-powered-by"]).toBeUndefined();
});

test("2FA: ativar em Minha conta, sair e entrar com o código", async ({ page }) => {
  await entrar(page, "elisa@exemplo.com");
  await page.getByRole("link", { name: "Minha conta" }).click();
  await page.getByRole("button", { name: "Ativar verificação em duas etapas" }).click();
  await expect(page.getByRole("img", { name: "QR code para o app autenticador" })).toBeVisible();
  const secret = (await page.locator("code").first().textContent())!.replace(/\s/g, "");

  // faz o papel do app autenticador
  const step = stepAt(new Date());
  await page.getByRole("textbox", { name: /Digite o código de 6 dígitos/ }).fill(codeForStep(secret, step));
  await page.getByRole("button", { name: "Confirmar e ativar" }).click();
  await expect(page.getByRole("status").filter({ hasText: "ativada" })).toBeVisible();
  await expect(page.getByRole("list", { name: "Códigos de recuperação" }).getByRole("listitem")).toHaveCount(10);

  await page.getByRole("button", { name: "Sair" }).click();
  await expect(page).toHaveURL(/\/login/); // espera o logout terminar antes de navegar
  await page.goto("/chamados");
  await page.getByLabel("Email").fill("elisa@exemplo.com");
  await page.getByLabel("Senha").fill("senha-demo-123");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/login\/codigo/);

  await page.getByRole("textbox", { name: "Código" }).fill("000000");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Código inválido" })).toBeVisible();

  await page.getByRole("textbox", { name: "Código" }).fill(codeForStep(secret, step + 1));
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByRole("heading", { name: "Chamados", level: 1 })).toBeVisible();
});

test("páginas e arquivos públicos abrem sem login; área logada fica fora da busca", async ({ page, request }) => {
  for (const [path, type] of [
    ["/robots.txt", "text/plain"], ["/sitemap.xml", "xml"], ["/llms.txt", "text/plain"],
    ["/manifest.webmanifest", "manifest"], ["/opengraph-image.jpg", "image/jpeg"], ["/icon-192.png", "image/png"],
  ] as const) {
    const res = await request.get(path, { maxRedirects: 0 });
    expect(res.status(), path).toBe(200);
    expect(res.headers()["content-type"], path).toContain(type);
  }
  expect(await (await request.get("/robots.txt")).text()).toContain("Disallow: /chamados");

  await page.goto("/privacidade");
  await expect(page.getByRole("heading", { name: "Privacidade", level: 1 })).toBeVisible();
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute("content", /opengraph-image/);
  const ld = JSON.parse((await page.locator('script[type="application/ld+json"]').textContent())!);
  expect(ld["@type"]).toBe("WebApplication");

  await entrar(page, "diego@exemplo.com");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
});
