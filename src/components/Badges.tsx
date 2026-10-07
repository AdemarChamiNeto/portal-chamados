import { PRIORITY_LABEL, STATUS_LABEL, formatMinutes } from "@/lib/labels";
import type { Priority, Sla, Status } from "@/lib/types";

const PRIORITY_CLASS: Record<Priority, string> = {
  critica: "text-p-critica border-p-critica",
  alta: "text-p-alta border-p-alta",
  media: "text-p-media border-p-media",
  baixa: "text-p-baixa border-p-baixa",
};

export function PriorityBadge({ priority }: { priority: Priority }) {
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-semibold ${PRIORITY_CLASS[priority]}`}>
      <span aria-hidden className="size-2 rounded-full bg-current" />
      {PRIORITY_LABEL[priority]}
    </span>
  );
}

export function StatusBadge({ status }: { status: Status }) {
  const tone =
    status === "resolvido" || status === "fechado" ? "border-ok text-ok"
    : status === "cancelado" ? "border-line text-muted"
    : status === "aguardando_usuario" ? "border-warn text-warn"
    : "border-line";
  return <span className={`whitespace-nowrap rounded-full border bg-surface-2 px-2 py-0.5 text-xs ${tone}`}>{STATUS_LABEL[status]}</span>;
}

/** Resumo do SLA em uma linha: pausado, atrasado, ou quanto falta em horas úteis. */
export function SlaIndicator({ sla, status }: { sla: Sla; status: Status }) {
  if (sla.paused) return <span className="text-sm text-warn">⏸ SLA pausado</span>;
  if (sla.business_minutes_left === null) {
    return status === "cancelado"
      ? <span className="text-sm text-muted">—</span>
      : <span className={`text-sm ${sla.resolution_breached ? "text-danger" : "text-ok"}`}>{sla.resolution_breached ? "Fora do SLA" : "Dentro do SLA"}</span>;
  }
  const left = sla.business_minutes_left;
  if (left < 0) return <span className="text-sm font-semibold text-danger">Atrasado {formatMinutes(left)}</span>;
  const soon = left <= 60;
  return <span className={`text-sm ${soon ? "font-semibold text-warn" : ""}`}>Faltam {formatMinutes(left)}</span>;
}
