// Contrato da API de Chamados (https://github.com/AdemarChamiNeto/api-chamados).
// O modo demonstração implementa exatamente estes tipos, então as telas não sabem qual backend está por trás.

export const STATUSES = ["aberto", "em_atendimento", "aguardando_usuario", "resolvido", "fechado", "cancelado"] as const;
export const PRIORITIES = ["critica", "alta", "media", "baixa"] as const;
export const LEVELS = ["alto", "medio", "baixo"] as const;
export const CATEGORIES = ["hardware", "software", "acesso", "rede", "impressao", "outros"] as const;
export const ROLES = ["solicitante", "tecnico", "admin"] as const;
export const SORTS = ["-created_at", "created_at", "-priority", "priority", "resolution_due_at", "-updated_at"] as const;

export type Status = (typeof STATUSES)[number];
export type Priority = (typeof PRIORITIES)[number];
export type Level = (typeof LEVELS)[number];
export type Category = (typeof CATEGORIES)[number];
export type Role = (typeof ROLES)[number];
export type Sort = (typeof SORTS)[number];

export interface User {
  id: number;
  name: string;
  email: string;
  role: Role;
  active: boolean;
}

export interface Sla {
  response_due_at: string;
  resolution_due_at: string;
  paused: boolean;
  response_breached: boolean;
  resolution_breached: boolean;
  /** negativo quando atrasado; null se pausado ou encerrado */
  business_minutes_left: number | null;
}

export interface Ticket {
  id: number;
  title: string;
  category: Category;
  impact: Level;
  urgency: Level;
  priority: Priority;
  status: Status;
  requester: { id: number; name: string };
  assignee: { id: number; name: string } | null;
  created_at: string;
  updated_at: string;
  first_response_at: string | null;
  resolved_at: string | null;
  closed_at: string | null;
  sla: Sla;
  allowed_status: Status[];
}

export interface Comment {
  id: number;
  body: string;
  internal: boolean;
  author: { id: number; name: string; role: Role };
  created_at: string;
}

export interface HistoryEntry {
  type: "created" | "status" | "assignee" | "priority";
  from: string | null;
  to: string | null;
  note: string | null;
  actor: string;
  at: string;
}

export interface TicketDetail extends Ticket {
  description: string;
  comments: Comment[];
  history: HistoryEntry[];
}

export interface Page<T> {
  data: T[];
  meta: { page: number; per_page: number; total: number; last_page: number };
}

export interface Metrics {
  by_status: Partial<Record<Status, number>>;
  open_by_priority: Partial<Record<Priority, number>>;
  open_by_category: Partial<Record<Category, number>>;
  overdue: number;
  period_days: number;
  resolved_in_period: number;
  response_sla_pct: number | null;
  resolution_sla_pct: number | null;
}

export interface TicketFilters {
  status?: Status[];
  priority?: Priority[];
  category?: Category;
  assignee?: "me" | "none" | number;
  overdue?: boolean;
  q?: string;
  sort?: Sort;
  page?: number;
  per_page?: number;
}

export interface NewTicket {
  title: string;
  description: string;
  category: Category;
  impact: Level;
  urgency: Level;
}

export const isStaff = (role: Role) => role !== "solicitante";
