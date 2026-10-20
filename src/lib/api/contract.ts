import type { Metrics, NewTicket, Page, Status, Ticket, TicketDetail, TicketFilters, User } from "../types";

/** Erro normalizado da API: {"error": {"code", "message", "details"?}}. */
export class ApiError extends Error {
  /** No 429: quanto esperar (do header Retry-After), em ms. */
  retryAfterMs: number | null = null;

  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details: Record<string, string> = {},
  ) {
    super(message);
    this.name = "ApiError";
  }

  get isUnauthorized() {
    return this.status === 401;
  }
}

/** Sem 2FA, o login já abre a sessão; com 2FA, devolve um token pendente (5 min) que só serve para o segundo passo. */
export type LoginResult =
  | { twoFactorRequired: false; token: string; user: User }
  | { twoFactorRequired: true; pendingToken: string };

/** Operações que as telas usam. Implementado pelo cliente HTTP (API real) e pelo modo demonstração. */
export interface ChamadosApi {
  login(email: string, password: string): Promise<LoginResult>;
  /** Segundo passo do login: código de 6 dígitos do app ou um código de recuperação. */
  loginSecondFactor(pendingToken: string, code: string): Promise<{ token: string; user: User; recoveryCodesLeft: number }>;
  me(): Promise<User>;
  twoFactorStatus(): Promise<{ enabled: boolean }>;
  setupTwoFactor(): Promise<{ secret: string; otpauthUrl: string }>;
  enableTwoFactor(code: string): Promise<{ recoveryCodes: string[] }>;
  disableTwoFactor(password: string, code: string): Promise<void>;
  listTickets(filters: TicketFilters): Promise<Page<Ticket>>;
  getTicket(id: number): Promise<TicketDetail>;
  createTicket(input: NewTicket): Promise<TicketDetail>;
  changeStatus(id: number, status: Status, note?: string): Promise<TicketDetail>;
  assign(id: number, assigneeId: number | null): Promise<TicketDetail>;
  comment(id: number, body: string, internal: boolean): Promise<TicketDetail>;
  metrics(days?: number): Promise<Metrics>;
}

/** Filtros → query string no formato da API (listas separadas por vírgula). */
export function toQuery(f: TicketFilters): URLSearchParams {
  const q = new URLSearchParams();
  if (f.status?.length) q.set("status", f.status.join(","));
  if (f.priority?.length) q.set("priority", f.priority.join(","));
  if (f.category) q.set("category", f.category);
  if (f.assignee !== undefined) q.set("assignee", String(f.assignee));
  if (f.overdue) q.set("overdue", "1");
  if (f.q) q.set("q", f.q);
  if (f.sort) q.set("sort", f.sort);
  if (f.page && f.page > 1) q.set("page", String(f.page));
  if (f.per_page) q.set("per_page", String(f.per_page));
  return q;
}
