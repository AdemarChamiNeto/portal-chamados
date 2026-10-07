import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { TicketFilters } from "./TicketFilters";
import { PriorityBadge, SlaIndicator, StatusBadge } from "@/components/Badges";
import { CATEGORY_LABEL, formatDateTime } from "@/lib/labels";
import { parseFilters, withPage } from "@/lib/filters";
import { requireSession } from "@/lib/server/session";
import { isStaff } from "@/lib/types";

export const metadata: Metadata = { title: "Chamados" };

type Search = Awaited<PageProps<"/chamados">["searchParams"]>;

async function Fila({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const { api, user } = await requireSession();
  const page = await api.listTickets(parseFilters(sp));
  const staff = isStaff(user.role);
  const { meta } = page;

  return (
    <>
      <TicketFilters key={JSON.stringify(sp)} staff={staff} values={Object.fromEntries(Object.entries(sp).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v ?? ""]))} />

      <div className="card mt-4 overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <caption className="sr-only">Chamados</caption>
          <thead className="text-left text-xs uppercase tracking-wide text-muted">
            <tr className="border-b border-line">
              <th scope="col" className="px-3 py-2">#</th>
              <th scope="col" className="px-3 py-2">Chamado</th>
              <th scope="col" className="px-3 py-2">Prioridade</th>
              <th scope="col" className="px-3 py-2">Status</th>
              {staff && <th scope="col" className="px-3 py-2">Responsável</th>}
              <th scope="col" className="px-3 py-2">SLA de solução</th>
            </tr>
          </thead>
          <tbody>
            {page.data.length === 0 && (
              <tr>
                <td colSpan={staff ? 6 : 5} className="px-3 py-10 text-center text-muted">Nenhum chamado com esses filtros.</td>
              </tr>
            )}
            {page.data.map((t) => (
              <tr key={t.id} className="border-b border-line last:border-0 hover:bg-surface-2">
                <td className="px-3 py-2 align-top font-mono text-muted">{t.id}</td>
                <td className="px-3 py-2 align-top">
                  <Link href={`/chamados/${t.id}`} className="font-medium text-accent underline-offset-2 hover:underline">{t.title}</Link>
                  <div className="text-xs text-muted">
                    {CATEGORY_LABEL[t.category]} · aberto em {formatDateTime(t.created_at)}{staff && ` por ${t.requester.name}`}
                  </div>
                </td>
                <td className="px-3 py-2 align-top"><PriorityBadge priority={t.priority} /></td>
                <td className="px-3 py-2 align-top"><StatusBadge status={t.status} /></td>
                {staff && <td className="px-3 py-2 align-top">{t.assignee?.name ?? <span className="text-muted">sem responsável</span>}</td>}
                <td className="px-3 py-2 align-top"><SlaIndicator sla={t.sla} status={t.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <nav aria-label="Paginação" className="mt-3 flex items-center justify-between text-sm">
        <span className="text-muted" aria-live="polite">{meta.total} chamado(s) · página {meta.page} de {meta.last_page}</span>
        <span className="flex gap-2">
          {meta.page > 1 ? <Link className="btn" href={`/chamados${withPage(sp, meta.page - 1)}`}>← Anterior</Link> : <span className="btn opacity-50" aria-disabled>← Anterior</span>}
          {meta.page < meta.last_page ? <Link className="btn" href={`/chamados${withPage(sp, meta.page + 1)}`}>Próxima →</Link> : <span className="btn opacity-50" aria-disabled>Próxima →</span>}
        </span>
      </nav>
    </>
  );
}

export default function ChamadosPage(props: PageProps<"/chamados">) {
  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Chamados</h1>
        <Link href="/chamados/novo" className="btn btn-primary">+ Abrir chamado</Link>
      </div>
      <Suspense fallback={<p className="card p-6 text-muted" role="status">Carregando chamados…</p>}>
        <Fila searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}
