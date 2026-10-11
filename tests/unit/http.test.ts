import { describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/contract";
import { HttpChamadosApi } from "@/lib/api/http";

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

describe("HttpChamadosApi", () => {
  it("envia o token e monta a query no formato da API", async () => {
    const fetchFn = vi.fn().mockResolvedValue(json(200, { data: [], meta: { page: 1, per_page: 20, total: 0, last_page: 1 } }));
    const api = new HttpChamadosApi("http://api.local", "tok123", fetchFn);
    await api.listTickets({ status: ["aberto", "em_atendimento"], overdue: true, sort: "-priority", page: 2 });
    const [url, init] = fetchFn.mock.calls[0];
    expect(String(url)).toBe("http://api.local/api/tickets?status=aberto%2Cem_atendimento&overdue=1&sort=-priority&page=2");
    expect(init.headers.Authorization).toBe("Bearer tok123");
    expect(init.cache).toBe("no-store");
  });

  it("normaliza o erro da API em ApiError, com os detalhes por campo", async () => {
    const fetchFn = vi.fn().mockResolvedValue(json(422, { error: { code: "validation_error", message: "Dados inválidos", details: { title: "Obrigatório" } } }));
    const err = await new HttpChamadosApi("http://api.local", "t", fetchFn).createTicket({} as never).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 422, code: "validation_error", details: { title: "Obrigatório" } });
  });

  it("401 é reconhecido como sessão inválida", async () => {
    const fetchFn = vi.fn().mockResolvedValue(json(401, { error: { code: "invalid_token", message: "Token expirado" } }));
    const err = await new HttpChamadosApi("http://api.local", "t", fetchFn).me().catch((e) => e);
    expect(err.isUnauthorized).toBe(true);
  });

  it("login com e sem 2FA, no formato da API", async () => {
    const semFetch = vi.fn().mockResolvedValue(json(200, { two_factor_required: false, token: "t1", user: { id: 2 } }));
    expect(await new HttpChamadosApi("http://api.local", null, semFetch).login("a@b.com", "x")).toEqual({ twoFactorRequired: false, token: "t1", user: { id: 2 } });

    const comFetch = vi.fn().mockResolvedValue(json(200, { two_factor_required: true, pending_token: "p1" }));
    expect(await new HttpChamadosApi("http://api.local", null, comFetch).login("a@b.com", "x")).toEqual({ twoFactorRequired: true, pendingToken: "p1" });

    const segundo = vi.fn().mockResolvedValue(json(200, { token: "t2", user: { id: 2 }, recovery_codes_left: 9 }));
    expect(await new HttpChamadosApi("http://api.local", null, segundo).loginSecondFactor("p1", "123456")).toEqual({ token: "t2", user: { id: 2 }, recoveryCodesLeft: 9 });
    const [url, init] = segundo.mock.calls[0];
    expect(String(url)).toBe("http://api.local/api/auth/2fa");
    expect(JSON.parse(init.body)).toEqual({ pending_token: "p1", code: "123456" });
  });

  it("falha de rede e resposta sem JSON viram erros legíveis", async () => {
    const offline = await new HttpChamadosApi("http://api.local", null, vi.fn().mockRejectedValue(new TypeError("fetch failed"))).me().catch((e) => e);
    expect(offline).toMatchObject({ status: 503, code: "unreachable" });
    const html = await new HttpChamadosApi("http://api.local", null, vi.fn().mockResolvedValue(new Response("<h1>502</h1>", { status: 502 }))).me().catch((e) => e);
    expect(html).toMatchObject({ status: 502, message: "Erro 502 na API" });
  });
});
