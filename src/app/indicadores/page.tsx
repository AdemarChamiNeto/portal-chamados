import type { Metadata } from "next";
import { Suspense } from "react";
import { CATEGORY_LABEL, PRIORITY_LABEL, STATUS_LABEL } from "@/lib/labels";
import { ApiError } from "@/lib/api/contract";
import { requireSession } from "@/lib/server/session";
import { CATEGORIES, PRIORITIES, STATUSES } from "@/lib/types";

export const metadata: Metadata = { title: "Indicadores" };

function Bars({ title, rows }: { title: string; rows: { label: string; value: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <section className="card p-5" aria-label={title}>
      <h2 className="mb-3 font-semibold">{title}</h2>
      <ul className="grid gap-2">
        {rows.map((r) => (
          <li key={r.label} className="grid grid-cols-[120px_1fr_2.5rem] items-center gap-2 text-sm">
            <span>{r.label}</span>
            <span className="h-3 rounded bg-surface-2" aria-hidden>
              <span className="block h-3 rounded bg-accent" style={{ width: `${(r.value / max) * 100}%` }} />
            </span>
            <span className="text-right font-mono">{r.value}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

async function Painel() {
  const { api } = await requireSession();
  let m;
  try {
    m = await api.metrics(30);
  } catch (e) {
    if (e instanceof ApiError && e.status === 403) {
      return <p className="card p-6" role="alert">Indicadores são visíveis só para a equipe de atendimento.</p>;
    }
    throw e;
  }
  const pct = (v: number | null) => (v === null ? "—" : `${v.toLocaleString("pt-BR")}%`);
  const kpis = [
    { label: "Em andamento", value: String((m.by_status.aberto ?? 0) + (m.by_status.em_atendimento ?? 0) + (m.by_status.aguardando_usuario ?? 0)) },
    { label: "Atrasados", value: String(m.overdue), alert: m.overdue > 0 },
    { label: `Resposta no SLA (${m.period_days} dias)`, value: pct(m.response_sla_pct) },
    { label: `Solução no SLA (${m.period_days} dias)`, value: pct(m.resolution_sla_pct) },
  ];
  return (
    <div className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="card p-4">
            <p className="text-sm text-muted">{k.label}</p>
            <p className={`text-3xl font-bold tabular-nums ${k.alert ? "text-danger" : ""}`}>{k.value}</p>
          </div>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Bars title="Por status" rows={STATUSES.map((s) => ({ label: STATUS_LABEL[s], value: m.by_status[s] ?? 0 }))} />
        <Bars title="Em andamento por prioridade" rows={PRIORITIES.map((p) => ({ label: PRIORITY_LABEL[p], value: m.open_by_priority[p] ?? 0 }))} />
        <Bars title="Em andamento por categoria" rows={CATEGORIES.map((c) => ({ label: CATEGORY_LABEL[c], value: m.open_by_category[c] ?? 0 }))} />
      </div>
      <p className="text-sm text-muted">{m.resolved_in_period} chamado(s) resolvido(s) nos últimos {m.period_days} dias.</p>
    </div>
  );
}

export default function IndicadoresPage() {
  return (
    <>
      <h1 className="mb-4 text-2xl font-bold">Indicadores</h1>
      <Suspense fallback={<p className="card p-6 text-muted" role="status">Carregando indicadores…</p>}>
        <Painel />
      </Suspense>
    </>
  );
}
