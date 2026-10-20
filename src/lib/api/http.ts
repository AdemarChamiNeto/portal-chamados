import { ApiError, toQuery, type ChamadosApi, type LoginResult } from "./contract";
import { backoff, CircuitBreaker, defaultResilience, retryAfterMs, type ResilienceOptions } from "./resilience";
import type { Metrics, NewTicket, Page, Status, Ticket, TicketDetail, TicketFilters, User } from "../types";

type Fetch = typeof fetch;

// Um circuit breaker por API: compartilhado entre as requisições do servidor do Next.
const breakers = new Map<string, CircuitBreaker>();
const breakerFor = (baseUrl: string) => {
  let b = breakers.get(baseUrl);
  if (!b) breakers.set(baseUrl, (b = new CircuitBreaker()));
  return b;
};

/** Falha que vale repetir num GET: pode passar sozinha. */
const transient = (e: ApiError) =>
  ["timeout", "unreachable", "invalid_response"].includes(e.code) || [502, 503, 504].includes(e.status);

/**
 * Cliente da API real. Faz o papel de "interceptor": todo request passa por `request()`, que
 * põe o token, define timeout, aplica a política de resiliência e transforma qualquer resposta
 * de erro em ApiError. Roda só no servidor — o token nunca chega ao navegador.
 */
export class HttpChamadosApi implements ChamadosApi {
  private readonly opts: ResilienceOptions;

  constructor(
    private readonly baseUrl: string,
    private readonly token: string | null = null,
    private readonly fetchFn: Fetch = fetch,
    options: Partial<ResilienceOptions> = {},
  ) {
    this.opts = { ...defaultResilience(options.breaker === undefined ? breakerFor(baseUrl) : options.breaker), ...options };
  }

  /**
   * O circuit breaker fica por fora das novas tentativas: conta o resultado final de cada
   * requisição, não cada tentativa (contando tentativas, uma API com 50% de erro abria o
   * circuito à toa e recusava requisições que teriam dado certo — a medição mostrou isso).
   */
  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const breaker = this.opts.breaker;
    const wait = breaker?.check() ?? null;
    if (wait !== null) {
      throw new ApiError(503, "circuit_open", `A API está instável. Tente de novo em ${Math.ceil(wait / 1000)} s.`);
    }
    try {
      const data = await this.withRetries<T>(method, path, body);
      breaker?.success();
      return data;
    } catch (e) {
      // 4xx é culpa de quem chamou e 429 é limite de uso: nenhum dos dois é API doente
      if (e instanceof ApiError && e.status >= 500) breaker?.failure();
      else if (e instanceof ApiError && e.status !== 429) breaker?.success();
      throw e;
    }
  }

  private async withRetries<T>(method: string, path: string, body?: unknown): Promise<T> {
    const o = this.opts;
    const idempotent = method === "GET" || method === "HEAD";
    const deadline = o.now() + o.budgetMs;

    for (let attempt = 0; ; attempt++) {
      const timeoutMs = idempotent ? Math.min(o.readTimeoutMs, Math.max(1, deadline - o.now())) : o.writeTimeoutMs;
      let error: ApiError;
      try {
        return await this.once<T>(method, path, body, timeoutMs);
      } catch (e) {
        if (!(e instanceof ApiError)) throw e;
        error = e;
      }

      const canRetry = idempotent && attempt < o.retries;
      if (error.status === 429) {
        const ms = error.retryAfterMs ?? 1000;
        if (!canRetry || ms > o.maxRetryAfterMs || o.now() + ms >= deadline) throw error;
        await o.sleep(ms);
        continue;
      }
      if (!canRetry || !transient(error)) throw error;
      const delay = backoff(attempt, o);
      if (o.now() + delay + 500 >= deadline) throw error; // não sobra tempo para outra tentativa útil
      await o.sleep(delay);
    }
  }

  /** Uma tentativa: chama a API e normaliza qualquer problema em ApiError. */
  private async once<T>(method: string, path: string, body: unknown, timeoutMs: number): Promise<T> {
    let res: Response;
    try {
      res = await this.fetchFn(new URL(path, this.baseUrl), {
        method,
        headers: {
          Accept: "application/json",
          ...(body !== undefined && { "Content-Type": "application/json" }),
          ...(this.token && { Authorization: `Bearer ${this.token}` }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        cache: "no-store",
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (e) {
      const timeout = e instanceof Error && e.name === "TimeoutError";
      throw new ApiError(503, timeout ? "timeout" : "unreachable", timeout ? "A API demorou demais para responder." : "Não foi possível conectar à API.");
    }

    if (res.status === 204) return undefined as T;
    const isJson = (res.headers.get("content-type") ?? "").includes("json");
    const data = isJson ? await res.json().catch(() => undefined) : undefined;

    if (!res.ok) {
      const err = data?.error;
      const apiError = err
        ? new ApiError(res.status, err.code ?? "http_error", err.message ?? `Erro ${res.status} na API`, err.details ?? {})
        : new ApiError(res.status, "http_error", isJson ? `Erro ${res.status} na API` : `A API (ou um proxy na frente dela) devolveu uma página de erro ${res.status}.`);
      if (res.status === 429) apiError.retryAfterMs = retryAfterMs(res.headers.get("retry-after"), this.opts.now());
      throw apiError;
    }
    // 200 com HTML (ou JSON quebrado): antes virava "sucesso" com dados nulos
    if (data === undefined) throw new ApiError(502, "invalid_response", "A API respondeu algo que não é JSON (provavelmente a página de erro de um proxy).");
    return data as T;
  }

  async login(email: string, password: string): Promise<LoginResult> {
    const r = await this.request<{ two_factor_required?: boolean; token?: string; user?: User; pending_token?: string }>(
      "POST", "/api/auth/login", { email, password },
    );
    return r.two_factor_required
      ? { twoFactorRequired: true, pendingToken: r.pending_token! }
      : { twoFactorRequired: false, token: r.token!, user: r.user! };
  }
  async loginSecondFactor(pendingToken: string, code: string) {
    const r = await this.request<{ token: string; user: User; recovery_codes_left: number }>(
      "POST", "/api/auth/2fa", { pending_token: pendingToken, code },
    );
    return { token: r.token, user: r.user, recoveryCodesLeft: r.recovery_codes_left };
  }
  me() {
    return this.request<User>("GET", "/api/me");
  }
  twoFactorStatus() {
    return this.request<{ enabled: boolean }>("GET", "/api/me/2fa");
  }
  async setupTwoFactor() {
    const r = await this.request<{ secret: string; otpauth_url: string }>("POST", "/api/me/2fa/setup");
    return { secret: r.secret, otpauthUrl: r.otpauth_url };
  }
  async enableTwoFactor(code: string) {
    const r = await this.request<{ recovery_codes: string[] }>("POST", "/api/me/2fa/enable", { code });
    return { recoveryCodes: r.recovery_codes };
  }
  async disableTwoFactor(password: string, code: string) {
    await this.request<void>("POST", "/api/me/2fa/disable", { password, code });
  }
  listTickets(filters: TicketFilters) {
    const qs = toQuery(filters).toString();
    return this.request<Page<Ticket>>("GET", `/api/tickets${qs ? `?${qs}` : ""}`);
  }
  getTicket(id: number) {
    return this.request<TicketDetail>("GET", `/api/tickets/${id}`);
  }
  createTicket(input: NewTicket) {
    return this.request<TicketDetail>("POST", "/api/tickets", input);
  }
  changeStatus(id: number, status: Status, note?: string) {
    return this.request<TicketDetail>("PATCH", `/api/tickets/${id}/status`, { status, ...(note && { note }) });
  }
  assign(id: number, assigneeId: number | null) {
    return this.request<TicketDetail>("PATCH", `/api/tickets/${id}/assignee`, { assignee_id: assigneeId });
  }
  comment(id: number, body: string, internal: boolean) {
    return this.request<TicketDetail>("POST", `/api/tickets/${id}/comments`, { body, internal });
  }
  metrics(days = 30) {
    return this.request<Metrics>("GET", `/api/metrics?days=${days}`);
  }
}
