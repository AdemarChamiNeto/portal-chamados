import type { Category, Level, Priority, Role, Status } from "./types";

export const STATUS_LABEL: Record<Status, string> = {
  aberto: "Aberto",
  em_atendimento: "Em atendimento",
  aguardando_usuario: "Aguardando usuário",
  resolvido: "Resolvido",
  fechado: "Fechado",
  cancelado: "Cancelado",
};

export const PRIORITY_LABEL: Record<Priority, string> = { critica: "Crítica", alta: "Alta", media: "Média", baixa: "Baixa" };
export const LEVEL_LABEL: Record<Level, string> = { alto: "Alto", medio: "Médio", baixo: "Baixo" };
export const CATEGORY_LABEL: Record<Category, string> = {
  hardware: "Hardware",
  software: "Software",
  acesso: "Acesso",
  rede: "Rede",
  impressao: "Impressão",
  outros: "Outros",
};
export const ROLE_LABEL: Record<Role, string> = { solicitante: "Solicitante", tecnico: "Técnico", admin: "Admin" };

/** Verbo da ação que leva a cada status (rótulo dos botões). */
export const STATUS_ACTION: Record<Status, string> = {
  aberto: "Reabrir",
  em_atendimento: "Atender",
  aguardando_usuario: "Pedir informação",
  resolvido: "Resolver",
  fechado: "Fechar",
  cancelado: "Cancelar",
};

export const NOTE_REQUIRED: Status[] = ["aguardando_usuario", "resolvido", "cancelado"];

const dateTime = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });
export const formatDateTime = (iso: string) => dateTime.format(new Date(iso));

/** 75 → "1 h 15 min"; minutos úteis do SLA. */
export function formatMinutes(min: number): string {
  const abs = Math.abs(min);
  const d = Math.floor(abs / 540); // dia útil = 9 h
  const h = Math.floor((abs % 540) / 60);
  const m = abs % 60;
  const parts = [d && `${d} ${d > 1 ? "dias úteis" : "dia útil"}`, h && `${h} h`, (m || (!d && !h)) && `${m} min`].filter(Boolean);
  return parts.join(" ");
}
