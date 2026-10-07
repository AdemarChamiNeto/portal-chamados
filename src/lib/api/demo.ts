import { BusinessCalendar } from "../calendar";
import { PRIORITY_WEIGHT, SLA_TARGETS, priorityFromMatrix } from "../priority";
import {
  CATEGORIES, LEVELS, isStaff,
  type Comment, type HistoryEntry, type Metrics, type NewTicket, type Page, type Priority, type Role,
  type Status, type Ticket, type TicketDetail, type TicketFilters, type User,
} from "../types";
import { ApiError, type ChamadosApi } from "./contract";

/**
 * Modo demonstração: uma cópia em memória das regras da API em PHP (prioridade ITIL, SLA em horário comercial,
 * pausa enquanto aguarda o usuário, permissões por papel, comentários internos). Permite publicar o portal
 * sem servidor de banco. Os dados vivem na memória do processo e voltam ao estado inicial quando ele reinicia.
 */

export const DEMO_PASSWORD = "senha-demo-123";
export const DEMO_USERS: User[] = [
  { id: 1, name: "Ana Admin", email: "admin@exemplo.com", role: "admin", active: true },
  { id: 2, name: "Bruno Técnico", email: "bruno@exemplo.com", role: "tecnico", active: true },
  { id: 3, name: "Carla Técnica", email: "carla@exemplo.com", role: "tecnico", active: true },
  { id: 4, name: "Diego Financeiro", email: "diego@exemplo.com", role: "solicitante", active: true },
  { id: 5, name: "Elisa RH", email: "elisa@exemplo.com", role: "solicitante", active: true },
];

interface Row {
  id: number;
  title: string;
  description: string;
  category: Ticket["category"];
  impact: Ticket["impact"];
  urgency: Ticket["urgency"];
  priority: Priority;
  status: Status;
  requesterId: number;
  assigneeId: number | null;
  createdAt: Date;
  updatedAt: Date;
  firstResponseAt: Date | null;
  resolvedAt: Date | null;
  closedAt: Date | null;
  pausedAt: Date | null;
  pausedMinutes: number;
  responseDueAt: Date;
  resolutionDueAt: Date;
  comments: (Omit<Comment, "author" | "created_at"> & { authorId: number; createdAt: Date })[];
  history: (Omit<HistoryEntry, "actor" | "at"> & { actorId: number; at: Date })[];
}

const TRANSITIONS: Record<"staff" | "requester", Partial<Record<Status, Status[]>>> = {
  staff: {
    aberto: ["em_atendimento", "cancelado"],
    em_atendimento: ["aguardando_usuario", "resolvido"],
    aguardando_usuario: ["em_atendimento", "resolvido"],
    resolvido: ["em_atendimento", "fechado"],
  },
  requester: {
    aberto: ["cancelado"],
    resolvido: ["fechado", "em_atendimento"],
  },
};
const ACTIVE: Status[] = ["aberto", "em_atendimento", "aguardando_usuario"];
const NEEDS_NOTE: Status[] = ["aguardando_usuario", "resolvido", "cancelado"];
const iso = (d: Date | null) => (d ? d.toISOString().replace(/\.\d{3}Z$/, "Z") : null);

export class DemoStore {
  rows: Row[] = [];
  nextId = 1;
  readonly calendar = new BusinessCalendar();

  constructor(public now: () => Date = () => new Date()) {}

  user(id: number) {
    const u = DEMO_USERS.find((x) => x.id === id);
    if (!u) throw new ApiError(401, "invalid_token", "Usuário inexistente ou desativado");
    return u;
  }

  deadlines(priority: Priority, createdAt: Date, paused = 0) {
    const [resp, res] = SLA_TARGETS[priority];
    return {
      responseDueAt: this.calendar.addBusinessMinutes(createdAt, resp),
      resolutionDueAt: this.calendar.addBusinessMinutes(createdAt, res + paused),
    };
  }

  /** Encerra uma pausa em andamento, somando o tempo útil parado e empurrando o prazo. */
  resume(r: Row, at: Date) {
    if (!r.pausedAt) return;
    r.pausedMinutes += this.calendar.businessMinutesBetween(r.pausedAt, at);
    r.pausedAt = null;
    r.resolutionDueAt = this.deadlines(r.priority, r.createdAt, r.pausedMinutes).resolutionDueAt;
  }

  present(r: Row, role: Role): Ticket {
    const now = this.now();
    const active = ACTIVE.includes(r.status);
    const paused = r.pausedAt !== null;
    const responseBreached = r.firstResponseAt ? r.firstResponseAt > r.responseDueAt : active && now > r.responseDueAt;
    const resolutionBreached = r.resolvedAt ? r.resolvedAt > r.resolutionDueAt : !paused && active && now > r.resolutionDueAt;
    const left = paused || r.resolvedAt || !active
      ? null
      : now < r.resolutionDueAt
        ? this.calendar.businessMinutesBetween(now, r.resolutionDueAt)
        : -this.calendar.businessMinutesBetween(r.resolutionDueAt, now);
    const requester = this.user(r.requesterId);
    const assignee = r.assigneeId ? this.user(r.assigneeId) : null;
    return {
      id: r.id, title: r.title, category: r.category, impact: r.impact, urgency: r.urgency,
      priority: r.priority, status: r.status,
      requester: { id: requester.id, name: requester.name },
      assignee: assignee && { id: assignee.id, name: assignee.name },
      created_at: iso(r.createdAt)!, updated_at: iso(r.updatedAt)!,
      first_response_at: iso(r.firstResponseAt), resolved_at: iso(r.resolvedAt), closed_at: iso(r.closedAt),
      sla: {
        response_due_at: iso(r.responseDueAt)!, resolution_due_at: iso(r.resolutionDueAt)!, paused,
        response_breached: responseBreached, resolution_breached: resolutionBreached, business_minutes_left: left,
      },
      allowed_status: TRANSITIONS[isStaff(role) ? "staff" : "requester"][r.status] ?? [],
    };
  }

  detail(r: Row, role: Role): TicketDetail {
    return {
      ...this.present(r, role),
      description: r.description,
      comments: r.comments
        .filter((c) => isStaff(role) || !c.internal)
        .map((c) => {
          const a = this.user(c.authorId);
          return { id: c.id, body: c.body, internal: c.internal, author: { id: a.id, name: a.name, role: a.role }, created_at: iso(c.createdAt)! };
        }),
      history: r.history.map((h) => ({ type: h.type, from: h.from, to: h.to, note: h.note, actor: this.user(h.actorId).name, at: iso(h.at)! })),
    };
  }
}

/** Uma "sessão" da API de demonstração para um usuário (o token é o ID do usuário). */
export class DemoChamadosApi implements ChamadosApi {
  constructor(private readonly store: DemoStore, private readonly userId: number | null = null) {}

  private me_(): User {
    if (this.userId === null) throw new ApiError(401, "unauthenticated", "Envie o header Authorization: Bearer <token>");
    return this.store.user(this.userId);
  }

  private load(id: number, user: User) {
    const r = this.store.rows.find((x) => x.id === id);
    if (!r || (!isStaff(user.role) && r.requesterId !== user.id)) throw new ApiError(404, "not_found", "Chamado não encontrado");
    return r;
  }

  async login(email: string, password: string) {
    const user = DEMO_USERS.find((u) => u.email === email.trim().toLowerCase());
    if (!user || password !== DEMO_PASSWORD) throw new ApiError(401, "invalid_credentials", "Email ou senha incorretos");
    return { token: `demo.${user.id}`, user };
  }

  async me() {
    return this.me_();
  }

  async listTickets(f: TicketFilters): Promise<Page<Ticket>> {
    const user = this.me_();
    const now = this.store.now();
    let rows = this.store.rows.filter((r) => isStaff(user.role) || r.requesterId === user.id);
    if (f.status?.length) rows = rows.filter((r) => f.status!.includes(r.status));
    if (f.priority?.length) rows = rows.filter((r) => f.priority!.includes(r.priority));
    if (f.category) rows = rows.filter((r) => r.category === f.category);
    if (f.assignee === "none") rows = rows.filter((r) => r.assigneeId === null);
    else if (f.assignee === "me") rows = rows.filter((r) => r.assigneeId === user.id);
    else if (typeof f.assignee === "number") rows = rows.filter((r) => r.assigneeId === f.assignee);
    if (f.overdue) rows = rows.filter((r) => (r.status === "aberto" || r.status === "em_atendimento") && !r.pausedAt && r.resolutionDueAt < now);
    if (f.q) {
      const q = f.q.toLowerCase();
      rows = rows.filter((r) => r.title.toLowerCase().includes(q) || r.description.toLowerCase().includes(q));
    }
    const sort = f.sort ?? "-created_at";
    const desc = sort.startsWith("-");
    const key = sort.replace(/^-/, "");
    const value = (r: Row) =>
      key === "priority" ? PRIORITY_WEIGHT[r.priority]
      : key === "resolution_due_at" ? r.resolutionDueAt.getTime()
      : key === "updated_at" ? r.updatedAt.getTime()
      : r.createdAt.getTime();
    rows = [...rows].sort((a, b) => (desc ? value(b) - value(a) : value(a) - value(b)) || b.id - a.id);

    const perPage = f.per_page ?? 20;
    if (perPage < 1 || perPage > 100) throw new ApiError(422, "validation_error", "Dados inválidos", { per_page: "Entre 1 e 100" });
    const page = Math.max(1, f.page ?? 1);
    return {
      data: rows.slice((page - 1) * perPage, page * perPage).map((r) => this.store.present(r, user.role)),
      meta: { page, per_page: perPage, total: rows.length, last_page: Math.max(1, Math.ceil(rows.length / perPage)) },
    };
  }

  async getTicket(id: number) {
    const user = this.me_();
    return this.store.detail(this.load(id, user), user.role);
  }

  async createTicket(input: NewTicket) {
    const user = this.me_();
    const details: Record<string, string> = {};
    const title = input.title?.trim() ?? "";
    const description = input.description?.trim() ?? "";
    if (title.length < 5 || title.length > 150) details.title = "Deve ter entre 5 e 150 caracteres";
    if (description.length < 10 || description.length > 5000) details.description = "Deve ter entre 10 e 5000 caracteres";
    if (!CATEGORIES.includes(input.category)) details.category = "Valor inválido";
    if (!LEVELS.includes(input.impact)) details.impact = "Valor inválido";
    if (!LEVELS.includes(input.urgency)) details.urgency = "Valor inválido";
    if (Object.keys(details).length) throw new ApiError(422, "validation_error", "Dados inválidos", details);

    const now = this.store.now();
    const priority = priorityFromMatrix(input.impact, input.urgency);
    const row: Row = {
      id: this.store.nextId++, title, description, category: input.category, impact: input.impact, urgency: input.urgency,
      priority, status: "aberto", requesterId: user.id, assigneeId: null, createdAt: now, updatedAt: now,
      firstResponseAt: null, resolvedAt: null, closedAt: null, pausedAt: null, pausedMinutes: 0,
      ...this.store.deadlines(priority, now), comments: [], history: [],
    };
    row.history.push({ type: "created", from: null, to: "aberto", note: null, actorId: user.id, at: now });
    this.store.rows.push(row);
    return this.store.detail(row, user.role);
  }

  async changeStatus(id: number, to: Status, note?: string) {
    const user = this.me_();
    const r = this.load(id, user);
    const staff = isStaff(user.role);
    if (r.status === to) throw new ApiError(409, "no_change", "O chamado já está nesse status");
    const allowed = TRANSITIONS[staff ? "staff" : "requester"][r.status] ?? [];
    if (!allowed.includes(to)) {
      throw new ApiError(409, "invalid_transition",
        `Não é possível ir de "${r.status}" para "${to}"${allowed.length ? ` (permitido: ${allowed.join(", ")})` : ""}`);
    }
    const text = note?.trim();
    if (NEEDS_NOTE.includes(to) && (!text || text.length < 5)) {
      throw new ApiError(422, "validation_error", "Dados inválidos", { note: `Obrigatória ao mudar para ${to}` });
    }

    const now = this.store.now();
    const from = r.status;
    if (from === "aguardando_usuario") this.store.resume(r, now);
    if (to === "aguardando_usuario") r.pausedAt = now;
    if (staff && !r.firstResponseAt) r.firstResponseAt = now;
    if (to === "em_atendimento" && r.assigneeId === null && user.role === "tecnico") r.assigneeId = user.id;
    if (to === "resolvido") r.resolvedAt = now;
    if (from === "resolvido" && to === "em_atendimento") r.resolvedAt = null;
    if (to === "fechado" || to === "cancelado") r.closedAt = now;
    r.status = to;
    r.updatedAt = now;
    r.history.push({ type: "status", from, to, note: text || null, actorId: user.id, at: now });
    if (text) r.comments.push({ id: this.nextCommentId(), body: text, internal: false, authorId: user.id, createdAt: now });
    return this.store.detail(r, user.role);
  }

  async assign(id: number, assigneeId: number | null) {
    const user = this.me_();
    if (!isStaff(user.role)) throw new ApiError(403, "forbidden", "Sem permissão para esta ação");
    const r = this.load(id, user);
    if (r.status === "fechado" || r.status === "cancelado") throw new ApiError(409, "ticket_closed", "Chamado encerrado não pode ser reatribuído");
    if (user.role === "tecnico" && assigneeId !== null && assigneeId !== user.id) throw new ApiError(403, "forbidden", "Técnico só pode atribuir o chamado a si mesmo");
    if (user.role === "tecnico" && assigneeId === null && r.assigneeId !== user.id) throw new ApiError(403, "forbidden", "Só o responsável atual ou um admin pode remover a atribuição");
    const target = assigneeId === null ? null : DEMO_USERS.find((u) => u.id === assigneeId);
    if (assigneeId !== null && (!target || !isStaff(target.role))) {
      throw new ApiError(422, "validation_error", "Dados inválidos", { assignee_id: "Deve ser um técnico ou admin ativo" });
    }
    const now = this.store.now();
    r.history.push({
      type: "assignee", from: r.assigneeId ? this.store.user(r.assigneeId).name : null, to: target?.name ?? null,
      note: null, actorId: user.id, at: now,
    });
    r.assigneeId = assigneeId;
    r.updatedAt = now;
    return this.store.detail(r, user.role);
  }

  async comment(id: number, body: string, internal: boolean) {
    const user = this.me_();
    const r = this.load(id, user);
    const staff = isStaff(user.role);
    const text = body.trim();
    const details: Record<string, string> = {};
    if (!text) details.body = "Obrigatório";
    if (internal && !staff) details.internal = "Só a equipe pode fazer comentário interno";
    if (Object.keys(details).length) throw new ApiError(422, "validation_error", "Dados inválidos", details);
    if (r.status === "fechado" || r.status === "cancelado") throw new ApiError(409, "ticket_closed", "Chamado encerrado não recebe comentários");

    const now = this.store.now();
    r.comments.push({ id: this.nextCommentId(), body: text, internal, authorId: user.id, createdAt: now });
    if (staff && !internal && !r.firstResponseAt) r.firstResponseAt = now;
    // resposta do solicitante tira o chamado da pausa
    if (!staff && r.status === "aguardando_usuario") {
      this.store.resume(r, now);
      r.history.push({ type: "status", from: r.status, to: "em_atendimento", note: "Resposta do solicitante", actorId: user.id, at: now });
      r.status = "em_atendimento";
    }
    r.updatedAt = now;
    return this.store.detail(r, user.role);
  }

  async metrics(days = 30): Promise<Metrics> {
    const user = this.me_();
    if (!isStaff(user.role)) throw new ApiError(403, "forbidden", "Sem permissão para esta ação");
    const now = this.store.now();
    const since = new Date(now.getTime() - days * 86_400_000);
    const rows = this.store.rows;
    const count = <K extends string>(list: Row[], key: (r: Row) => K) =>
      list.reduce<Partial<Record<K, number>>>((acc, r) => ({ ...acc, [key(r)]: (acc[key(r)] ?? 0) + 1 }), {});
    const open = rows.filter((r) => ACTIVE.includes(r.status));
    const resolved = rows.filter((r) => r.resolvedAt && r.resolvedAt >= since);
    const pct = (n: number) => (resolved.length ? Math.round((n / resolved.length) * 1000) / 10 : null);
    return {
      by_status: count(rows, (r) => r.status),
      open_by_priority: count(open, (r) => r.priority),
      open_by_category: count(open, (r) => r.category),
      overdue: rows.filter((r) => (r.status === "aberto" || r.status === "em_atendimento") && !r.pausedAt && r.resolutionDueAt < now).length,
      period_days: days,
      resolved_in_period: resolved.length,
      response_sla_pct: pct(resolved.filter((r) => r.firstResponseAt && r.firstResponseAt <= r.responseDueAt).length),
      resolution_sla_pct: pct(resolved.filter((r) => r.resolvedAt! <= r.resolutionDueAt).length),
    };
  }

  private nextCommentId() {
    return this.store.rows.reduce((max, r) => Math.max(max, ...r.comments.map((c) => c.id)), 0) + 1;
  }
}

/** Dados fictícios criados pela própria API de demonstração, com o relógio avançando (histórico coerente). */
export async function seedDemo(store: DemoStore, realNow: Date) {
  let clock = new Date(realNow.getTime() - 9 * 86_400_000);
  // começa numa segunda-feira 08:00 (SP) para os exemplos caírem em horário comercial
  while (clock.getUTCDay() !== 1) clock = new Date(clock.getTime() - 86_400_000);
  clock.setUTCHours(11, 0, 0, 0);
  const original = store.now;
  store.now = () => clock;
  const advance = (min: number) => (clock = new Date(clock.getTime() + min * 60_000));
  const as = (id: number) => new DemoChamadosApi(store, id);

  try {
    let t = await as(4).createTicket({ title: "Excel trava ao abrir planilha de fechamento", description: "O Excel fecha sozinho quando abro a planilha do fechamento mensal.", category: "software", impact: "medio", urgency: "alto" });
    advance(20); await as(2).changeStatus(t.id, "em_atendimento");
    advance(60); await as(2).changeStatus(t.id, "resolvido", "Reparo do Office e remoção de um suplemento antigo.");
    advance(120); await as(4).changeStatus(t.id, "fechado");

    advance(24 * 60);
    t = await as(5).createTicket({ title: "Sem acesso à pasta compartilhada do RH", description: "Desde ontem aparece \"acesso negado\" na pasta do RH no servidor.", category: "acesso", impact: "medio", urgency: "medio" });
    advance(30); await as(3).changeStatus(t.id, "em_atendimento");
    await as(3).comment(t.id, "Grupo do AD conferido; usuária está no grupo correto.", true);
    await as(3).changeStatus(t.id, "aguardando_usuario", "Pode me informar a etiqueta de patrimônio do computador?");
    advance(24 * 60); await as(5).comment(t.id, "É o PAT-01234.", false);
    advance(40); await as(3).changeStatus(t.id, "resolvido", "Credencial antiga salva no Windows; removida no Gerenciador de Credenciais.");

    advance(2 * 24 * 60);
    t = await as(4).createTicket({ title: "Sistema de vendas fora do ar para a equipe", description: "Ninguém do financeiro consegue acessar o sistema de pedidos.", category: "rede", impact: "alto", urgency: "alto" });
    await as(1).assign(t.id, 2);
    advance(15); await as(2).changeStatus(t.id, "em_atendimento");

    advance(180);
    await as(5).createTicket({ title: "Mouse com clique duplo falhando", description: "O botão esquerdo às vezes dá clique duplo sozinho.", category: "hardware", impact: "baixo", urgency: "baixo" });

    clock = new Date(realNow.getTime() - 2 * 3_600_000);
    t = await as(4).createTicket({ title: "VPN desconecta a cada 10 minutos", description: "Trabalhando de casa, a VPN cai várias vezes por hora.", category: "rede", impact: "medio", urgency: "alto" });
    advance(30); await as(3).changeStatus(t.id, "em_atendimento");
    await as(3).changeStatus(t.id, "aguardando_usuario", "Qual é o provedor de internet e o modelo do roteador?");

    clock = new Date(realNow.getTime() - 40 * 60_000);
    await as(5).createTicket({ title: "Impressora do RH imprimindo manchado", description: "As impressões saem com faixas cinzas na lateral.", category: "impressao", impact: "baixo", urgency: "medio" });
  } finally {
    store.now = original;
  }
}
