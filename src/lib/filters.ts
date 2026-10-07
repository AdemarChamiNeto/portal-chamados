import { CATEGORIES, PRIORITIES, SORTS, STATUSES, type Category, type Priority, type Sort, type Status, type TicketFilters } from "./types";

type Search = Record<string, string | string[] | undefined>;

/** Atalhos de status usados no filtro da tela. */
export const STATUS_GROUPS = {
  abertos: ["aberto", "em_atendimento", "aguardando_usuario"],
  encerrados: ["resolvido", "fechado", "cancelado"],
} satisfies Record<string, Status[]>;

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const list = <T extends string>(v: string | undefined, allowed: readonly T[]) =>
  (v?.split(",") ?? []).filter((x): x is T => (allowed as readonly string[]).includes(x));

/**
 * searchParams da URL → filtros da API. Valores inválidos são ignorados (não quebram a página),
 * e a URL continua sendo a fonte da verdade: dá para salvar ou compartilhar a busca.
 */
export function parseFilters(sp: Search): TicketFilters {
  const f: TicketFilters = {};
  // sem filtro de status, a fila mostra só o que está em andamento; "todos" desliga o filtro
  const status = one(sp.status) ?? "abertos";
  if (status === "todos") { /* sem filtro */ }
  else if (status in STATUS_GROUPS) f.status = [...STATUS_GROUPS[status as keyof typeof STATUS_GROUPS]];
  else if (status) {
    const s = list<Status>(status, STATUSES);
    if (s.length) f.status = s;
  }
  const p = list<Priority>(one(sp.prioridade), PRIORITIES);
  if (p.length) f.priority = p;
  const c = one(sp.categoria);
  if (c && (CATEGORIES as readonly string[]).includes(c)) f.category = c as Category;
  const a = one(sp.responsavel);
  if (a === "me" || a === "none") f.assignee = a;
  if (one(sp.atrasados) === "1") f.overdue = true;
  const q = one(sp.q)?.trim();
  if (q) f.q = q.slice(0, 100);
  const sort = one(sp.ordem);
  if (sort && (SORTS as readonly string[]).includes(sort)) f.sort = sort as Sort;
  const page = Number(one(sp.pagina));
  if (Number.isInteger(page) && page > 1) f.page = page;
  return f;
}

/** Mesma busca, outra página (para os links de paginação). */
export function withPage(sp: Search, page: number): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    const value = one(v);
    if (value && k !== "pagina") q.set(k, value);
  }
  if (page > 1) q.set("pagina", String(page));
  const s = q.toString();
  return s ? `?${s}` : "";
}
