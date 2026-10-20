import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api/contract";
import { falhaDaApi } from "@/lib/api/falha";

describe("falhaDaApi", () => {
  it("circuito aberto explica a pausa e quando tentar", () => {
    const f = falhaDaApi(new ApiError(503, "circuit_open", "A API está instável. Tente de novo em 12 s."));
    expect(f?.titulo).toBe("A API de chamados está instável");
    expect(f?.mensagem).toContain("Tente de novo em 12 s.");
  });

  it("429 usa o Retry-After", () => {
    const e = new ApiError(429, "rate_limited", "x");
    e.retryAfterMs = 4200;
    expect(falhaDaApi(e)?.mensagem).toBe("Espere 5 s e tente de novo.");
  });

  it("timeout, 5xx e resposta que não é JSON viram aviso de API indisponível", () => {
    expect(falhaDaApi(new ApiError(503, "timeout", "x"))?.titulo).toContain("demorou demais");
    expect(falhaDaApi(new ApiError(502, "invalid_response", "x"))?.titulo).toContain("Não foi possível falar");
    expect(falhaDaApi(new ApiError(500, "http_error", "x"))?.titulo).toContain("Não foi possível falar");
  });

  it("erro de regra de negócio e o que não é da API seguem o caminho normal", () => {
    expect(falhaDaApi(new ApiError(404, "not_found", "x"))).toBeNull();
    expect(falhaDaApi(new ApiError(401, "invalid_token", "x"))).toBeNull();
    expect(falhaDaApi(new Error("NEXT_REDIRECT"))).toBeNull();
  });
});
