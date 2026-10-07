import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AssignForm, CommentForm, StatusForm } from "./TicketActions";
import { PriorityBadge, SlaIndicator, StatusBadge } from "@/components/Badges";
import { ApiError } from "@/lib/api/contract";
import { CATEGORY_LABEL, LEVEL_LABEL, ROLE_LABEL, STATUS_LABEL, formatDateTime } from "@/lib/labels";
import { requireSession } from "@/lib/server/session";
import { isStaff, type HistoryEntry } from "@/lib/types";

export const metadata: Metadata = { title: "Chamado" };

function describe(h: HistoryEntry) {
  switch (h.type) {
    case "created": return "abriu o chamado";
    case "status": return `${STATUS_LABEL[h.from as keyof typeof STATUS_LABEL] ?? h.from} → ${STATUS_LABEL[h.to as keyof typeof STATUS_LABEL] ?? h.to}`;
    case "assignee": return h.to ? `atribuiu a ${h.to}` : "removeu o responsável";
    case "priority": return `mudou a prioridade de ${h.from} para ${h.to}`;
  }
}

async function Detalhe({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: PageProps<"/chamados/[id]">["searchParams"] }) {
  const { id } = await params;
  const sp = await searchParams;
  if (!/^\d+$/.test(id)) notFound();
  const { api, user } = await requireSession();

  let t;
  try {
    t = await api.getTicket(Number(id));
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }
  const staff = isStaff(user.role);
  const encerrado = t.status === "fechado" || t.status === "cancelado";

  return (
    <article className="grid items-start gap-4 lg:grid-cols-[1fr_320px]">
      <div className="grid gap-4">
        {sp.novo && <p role="status" className="rounded-lg border border-ok p-3 text-sm text-ok">Chamado aberto. A equipe foi notificada.</p>}
        <header className="card p-5">
          <p className="font-mono text-sm text-muted">#{t.id}</p>
          <h1 className="text-2xl font-bold">{t.title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <PriorityBadge priority={t.priority} />
            <StatusBadge status={t.status} />
            <span className="text-sm text-muted">{CATEGORY_LABEL[t.category]}</span>
          </div>
          <p className="mt-4 whitespace-pre-line">{t.description}</p>
        </header>

        <section className="card p-5" aria-labelledby="conversa">
          <h2 id="conversa" className="mb-3 text-lg font-semibold">Conversa</h2>
          {t.comments.length === 0 && <p className="text-sm text-muted">Nenhum comentário ainda.</p>}
          <ol className="grid gap-3">
            {t.comments.map((c) => (
              <li key={c.id} className={`rounded-lg border p-3 ${c.internal ? "border-dashed border-warn bg-surface-2" : "border-line"}`}>
                <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-muted">
                  <strong className="text-text">{c.author.name}</strong>
                  <span>{ROLE_LABEL[c.author.role]}</span>
                  <time dateTime={c.created_at}>{formatDateTime(c.created_at)}</time>
                  {c.internal && <span className="font-semibold text-warn">interno · só a equipe vê</span>}
                </div>
                <p className="whitespace-pre-line text-sm">{c.body}</p>
              </li>
            ))}
          </ol>
          {!encerrado && <CommentForm id={t.id} staff={staff} />}
        </section>
      </div>

      <aside className="grid content-start gap-4">
        <section className="card p-5" aria-labelledby="sla-titulo">
          <h2 id="sla-titulo" className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">SLA</h2>
          <SlaIndicator sla={t.sla} status={t.status} />
          <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
            <dt className="text-muted">1ª resposta até</dt>
            <dd className={t.sla.response_breached ? "text-danger" : ""}>{formatDateTime(t.sla.response_due_at)}{t.sla.response_breached && " (estourou)"}</dd>
            <dt className="text-muted">Solução até</dt>
            <dd className={t.sla.resolution_breached ? "text-danger" : ""}>{formatDateTime(t.sla.resolution_due_at)}</dd>
            <dt className="text-muted">Impacto</dt><dd>{LEVEL_LABEL[t.impact]}</dd>
            <dt className="text-muted">Urgência</dt><dd>{LEVEL_LABEL[t.urgency]}</dd>
            <dt className="text-muted">Solicitante</dt><dd>{t.requester.name}</dd>
            <dt className="text-muted">Responsável</dt><dd>{t.assignee?.name ?? "—"}</dd>
          </dl>
          <p className="mt-2 text-xs text-muted">Prazos em horário comercial (seg–sex, 8–12 h e 13–18 h).</p>
        </section>

        {(t.allowed_status.length > 0 || (staff && !encerrado)) && (
          <section className="card grid gap-3 p-5" aria-labelledby="acoes">
            <h2 id="acoes" className="text-sm font-semibold uppercase tracking-wide text-muted">Ações</h2>
            {staff && !encerrado && (
              <AssignForm id={t.id} mine={t.assignee?.id === user.id} canRelease={t.assignee?.id === user.id || user.role === "admin"} hasAssignee={!!t.assignee} />
            )}
            {t.allowed_status.length > 0 && <StatusForm key={t.status} id={t.id} allowed={t.allowed_status} />}
          </section>
        )}

        <section className="card p-5" aria-labelledby="historico">
          <h2 id="historico" className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">Histórico</h2>
          <ol className="grid gap-2 text-sm">
            {t.history.map((h, i) => (
              <li key={i}>
                <time dateTime={h.at} className="text-xs text-muted">{formatDateTime(h.at)}</time>
                <p><strong>{h.actor}</strong> {describe(h)}</p>
                {h.note && <p className="text-xs text-muted">“{h.note}”</p>}
              </li>
            ))}
          </ol>
        </section>
        <Link href="/chamados" className="btn">← Voltar para a fila</Link>
      </aside>
    </article>
  );
}

export default function ChamadoPage(props: PageProps<"/chamados/[id]">) {
  return (
    <Suspense fallback={<p className="card p-6 text-muted" role="status">Carregando chamado…</p>}>
      <Detalhe params={props.params} searchParams={props.searchParams} />
    </Suspense>
  );
}
