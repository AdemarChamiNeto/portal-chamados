import { describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/contract";
import { HttpChamadosApi } from "@/lib/api/http";
import { backoff, CircuitBreaker, retryAfterMs, type ResilienceOptions } from "@/lib/api/resilience";

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...headers } });
const html = (status: number) => new Response("<html><body><h1>502 Bad Gateway</h1><hr>nginx</body></html>", { status, headers: { "Content-Type": "text/html" } });
const page = () => json(200, { data: [], meta: { page: 1, per_page: 20, total: 0, last_page: 1 } });

/** Sem breaker compartilhado e sem espera de verdade: as esperas ficam registradas em `sleeps`. */
function setup(fetchFn: ReturnType<typeof vi.fn>, opts: Partial<ResilienceOptions> = {}, token: string | null = "t") {
  const sleeps: number[] = [];
  let now = 0;
  const api = new HttpChamadosApi("http://api.local", token, fetchFn as unknown as typeof fetch, {
    breaker: null,
    random: () => 0,
    now: () => now,
    sleep: async (ms) => {
      sleeps.push(ms);
      now += ms;
    },
    ...opts,
  });
  return { api, sleeps };
}

describe("HttpChamadosApi", () => {
  it("envia o token e monta a query no formato da API", async () => {
    const fetchFn = vi.fn().mockResolvedValue(page());
    await setup(fetchFn, {}, "tok123").api.listTickets({ status: ["aberto", "em_atendimento"], overdue: true, sort: "-priority", page: 2 });
    const [url, init] = fetchFn.mock.calls[0];
    expect(String(url)).toBe("http://api.local/api/tickets?status=aberto%2Cem_atendimento&overdue=1&sort=-priority&page=2");
    expect(init.headers.Authorization).toBe("Bearer tok123");
    expect(init.cache).toBe("no-store");
  });

  it("normaliza o erro da API em ApiError, com os detalhes por campo", async () => {
    const fetchFn = vi.fn().mockResolvedValue(json(422, { error: { code: "validation_error", message: "Dados inválidos", details: { title: "Obrigatório" } } }));
    const err = await setup(fetchFn).api.createTicket({} as never).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 422, code: "validation_error", details: { title: "Obrigatório" } });
  });

  it("401 é reconhecido como sessão inválida", async () => {
    const fetchFn = vi.fn().mockResolvedValue(json(401, { error: { code: "invalid_token", message: "Token expirado" } }));
    const err = await setup(fetchFn).api.me().catch((e) => e);
    expect(err.isUnauthorized).toBe(true);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("login com e sem 2FA, no formato da API", async () => {
    const semFetch = vi.fn().mockResolvedValue(json(200, { two_factor_required: false, token: "t1", user: { id: 2 } }));
    expect(await setup(semFetch, {}, null).api.login("a@b.com", "x")).toEqual({ twoFactorRequired: false, token: "t1", user: { id: 2 } });

    const comFetch = vi.fn().mockResolvedValue(json(200, { two_factor_required: true, pending_token: "p1" }));
    expect(await setup(comFetch, {}, null).api.login("a@b.com", "x")).toEqual({ twoFactorRequired: true, pendingToken: "p1" });

    const segundo = vi.fn().mockResolvedValue(json(200, { token: "t2", user: { id: 2 }, recovery_codes_left: 9 }));
    expect(await setup(segundo, {}, null).api.loginSecondFactor("p1", "123456")).toEqual({ token: "t2", user: { id: 2 }, recoveryCodesLeft: 9 });
    const [url, init] = segundo.mock.calls[0];
    expect(String(url)).toBe("http://api.local/api/auth/2fa");
    expect(JSON.parse(init.body)).toEqual({ pending_token: "p1", code: "123456" });
  });

  it("falha de rede e página HTML de erro viram erros legíveis", async () => {
    const offline = await setup(vi.fn().mockRejectedValue(new TypeError("fetch failed"))).api.me().catch((e) => e);
    expect(offline).toMatchObject({ status: 503, code: "unreachable" });
    const pagina = await setup(vi.fn().mockResolvedValue(html(502))).api.me().catch((e) => e);
    expect(pagina).toMatchObject({ status: 502, code: "http_error" });
    expect(pagina.message).toContain("página de erro 502");
  });

  it("200 com HTML não vira sucesso com dados nulos", async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response("<html>ok?</html>", { status: 200, headers: { "Content-Type": "text/html" } }));
    const err = await setup(fetchFn, { retries: 0 }).api.me().catch((e) => e);
    expect(err).toMatchObject({ status: 502, code: "invalid_response" });
  });
});

describe("resiliência", () => {
  it("GET com 503 tenta de novo, com espera crescente, e dá certo", async () => {
    const fetchFn = vi.fn()
      .mockResolvedValueOnce(json(503, { error: { code: "injected_fault", message: "x" } }))
      .mockResolvedValueOnce(html(502))
      .mockResolvedValueOnce(page());
    const { api, sleeps } = setup(fetchFn);
    await expect(api.listTickets({})).resolves.toMatchObject({ data: [] });
    expect(fetchFn).toHaveBeenCalledTimes(3);
    expect(sleeps).toEqual([200, 400]);
  });

  it("desiste depois de 2 novas tentativas", async () => {
    const fetchFn = vi.fn().mockResolvedValue(json(503, { error: { code: "x", message: "fora" } }));
    const err = await setup(fetchFn).api.me().catch((e) => e);
    expect(err.status).toBe(503);
    expect(fetchFn).toHaveBeenCalledTimes(3);
  });

  it("POST nunca repete (abriria o chamado duas vezes)", async () => {
    const fetchFn = vi.fn().mockResolvedValue(json(503, { error: { code: "x", message: "fora" } }));
    await setup(fetchFn).api.createTicket({} as never).catch(() => null);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("4xx não repete: é culpa de quem chamou", async () => {
    const fetchFn = vi.fn().mockResolvedValue(json(404, { error: { code: "not_found", message: "Chamado não encontrado" } }));
    await setup(fetchFn).api.getTicket(9).catch(() => null);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("429 com Retry-After curto: espera o que a API pediu e tenta de novo", async () => {
    const fetchFn = vi.fn()
      .mockResolvedValueOnce(json(429, { error: { code: "rate_limited", message: "Calma" } }, { "Retry-After": "1" }))
      .mockResolvedValueOnce(page());
    const { api, sleeps } = setup(fetchFn);
    await api.listTickets({});
    expect(sleeps).toEqual([1000]);
  });

  it("429 com Retry-After longo: não prende a tela, devolve o erro com a espera", async () => {
    const fetchFn = vi.fn().mockResolvedValue(json(429, { error: { code: "rate_limited", message: "Muitas requisições" } }, { "Retry-After": "30" }));
    const err = await setup(fetchFn).api.me().catch((e) => e);
    expect(err).toMatchObject({ status: 429, retryAfterMs: 30_000 });
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("timeout de cada tentativa respeita o orçamento total", async () => {
    // cada tentativa "gasta" o timeout inteiro, como uma API travada
    let now = 0;
    const fetchFn = vi.fn().mockImplementation(async () => {
      now += 4000;
      throw Object.assign(new Error("t"), { name: "TimeoutError" });
    });
    const { api } = setup(fetchFn, { budgetMs: 9000, readTimeoutMs: 4000, now: () => now, sleep: async (ms) => void (now += ms) });
    const err = await api.me().catch((e) => e);
    expect(err.code).toBe("timeout");
    // 4 s + espera + 4 s = 8,2 s: não sobra tempo para uma 3ª tentativa útil dentro dos 9 s
    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(now).toBeLessThanOrEqual(9000);
  });

  it("circuit breaker abre depois de 5 falhas e recusa sem chamar a API", async () => {
    let now = 0;
    const breaker = new CircuitBreaker(5, 15_000, () => now);
    const fetchFn = vi.fn().mockResolvedValue(json(503, { error: { code: "x", message: "fora" } }));
    const { api } = setup(fetchFn, { breaker, retries: 0, now: () => now });

    for (let i = 0; i < 5; i++) await api.me().catch(() => null);
    expect(breaker.state).toBe("aberto");

    const recusado = await api.me().catch((e) => e);
    expect(recusado).toMatchObject({ status: 503, code: "circuit_open" });
    expect(recusado.message).toContain("15 s");
    expect(fetchFn).toHaveBeenCalledTimes(5);

    // passado o tempo, deixa uma tentativa testar; deu certo → fecha
    now += 15_000;
    fetchFn.mockResolvedValueOnce(json(200, { id: 1 }));
    await expect(api.me()).resolves.toEqual({ id: 1 });
    expect(breaker.state).toBe("fechado");
  });

  it("meio-aberto: se o teste falhar, abre de novo na hora", () => {
    let now = 0;
    const b = new CircuitBreaker(2, 1000, () => now);
    b.failure();
    b.failure();
    now = 1000;
    expect(b.check()).toBeNull(); // a requisição de teste
    expect(b.check()).toBe(1000); // as outras esperam o teste
    b.failure();
    expect(b.state).toBe("aberto");
  });

  it("circuito conta requisições, não tentativas: falha que passa na nova tentativa não conta", async () => {
    const breaker = new CircuitBreaker(2);
    const erro = () => json(503, { error: { code: "x", message: "fora" } });
    // cada requisição falha 2 vezes e dá certo na 3ª tentativa
    const fetchFn = vi.fn()
      .mockResolvedValueOnce(erro()).mockResolvedValueOnce(erro()).mockResolvedValueOnce(page())
      .mockResolvedValueOnce(erro()).mockResolvedValueOnce(erro()).mockResolvedValueOnce(page());
    const { api } = setup(fetchFn, { breaker });
    await api.listTickets({});
    await api.listTickets({});
    expect(breaker.state).toBe("fechado");
  });

  it("4xx e 429 não abrem o circuito", async () => {
    const breaker = new CircuitBreaker(2);
    const fetchFn = vi.fn().mockResolvedValue(json(422, { error: { code: "validation_error", message: "x" } }));
    const { api } = setup(fetchFn, { breaker });
    for (let i = 0; i < 4; i++) await api.createTicket({} as never).catch(() => null);
    expect(breaker.state).toBe("fechado");
  });

  it("espera crescente e Retry-After em segundos ou data", () => {
    expect([0, 1, 2].map((n) => backoff(n, { baseDelayMs: 200, random: () => 0.5 }))).toEqual([300, 500, 900]);
    expect(retryAfterMs("3", 0)).toBe(3000);
    expect(retryAfterMs(new Date(10_000).toUTCString(), 4000)).toBe(6000);
    expect(retryAfterMs("depois", 0)).toBeNull();
  });
});
