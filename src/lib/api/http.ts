import { ApiError, toQuery, type ChamadosApi } from "./contract";
import type { Metrics, NewTicket, Page, Status, Ticket, TicketDetail, TicketFilters, User } from "../types";

type Fetch = typeof fetch;

/**
 * Cliente da API real. Faz o papel de "interceptor": todo request passa por `request()`, que
 * põe o token, define timeout e transforma qualquer resposta de erro em ApiError.
 * Roda só no servidor — o token nunca chega ao navegador.
 */
export class HttpChamadosApi implements ChamadosApi {
  constructor(
    private readonly baseUrl: string,
    private readonly token: string | null = null,
    private readonly fetchFn: Fetch = fetch,
    private readonly timeoutMs = 8000,
  ) {}

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
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
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (e) {
      const timeout = e instanceof Error && e.name === "TimeoutError";
      throw new ApiError(503, timeout ? "timeout" : "unreachable", timeout ? "A API demorou demais para responder." : "Não foi possível conectar à API.");
    }

    if (res.status === 204) return undefined as T;
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      const err = data?.error;
      throw new ApiError(res.status, err?.code ?? "http_error", err?.message ?? `Erro ${res.status} na API`, err?.details ?? {});
    }
    return data as T;
  }

  login(email: string, password: string) {
    return this.request<{ token: string; user: User }>("POST", "/api/auth/login", { email, password });
  }
  me() {
    return this.request<User>("GET", "/api/me");
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
