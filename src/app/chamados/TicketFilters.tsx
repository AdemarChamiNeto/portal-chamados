"use client";

import Form from "next/form";
import { useRef } from "react";
import { CATEGORY_LABEL, PRIORITY_LABEL } from "@/lib/labels";
import { CATEGORIES, PRIORITIES } from "@/lib/types";

/**
 * Filtros como um formulário GET (next/form): a URL guarda a busca, o botão "voltar" funciona
 * e dá para compartilhar o link. Selects enviam sozinhos ao mudar; a busca por texto, no Enter.
 */
export function TicketFilters({ staff, values }: { staff: boolean; values: Record<string, string> }) {
  const form = useRef<HTMLFormElement>(null);
  const submit = () => form.current?.requestSubmit();

  return (
    <Form ref={form} action="/chamados" className="card grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-6" aria-label="Filtros">
      <div className="lg:col-span-2">
        <label htmlFor="q" className="label">Buscar</label>
        <input id="q" name="q" type="search" className="field" placeholder="título ou descrição" defaultValue={values.q} />
      </div>
      <div>
        <label htmlFor="status" className="label">Status</label>
        <select id="status" name="status" className="field" defaultValue={values.status || "abertos"} onChange={submit}>
          <option value="abertos">Em andamento</option>
          <option value="aberto">Só abertos</option>
          <option value="aguardando_usuario">Aguardando usuário</option>
          <option value="encerrados">Encerrados</option>
          <option value="todos">Todos</option>
        </select>
      </div>
      <div>
        <label htmlFor="prioridade" className="label">Prioridade</label>
        <select id="prioridade" name="prioridade" className="field" defaultValue={values.prioridade ?? ""} onChange={submit}>
          <option value="">Todas</option>
          {PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="categoria" className="label">Categoria</label>
        <select id="categoria" name="categoria" className="field" defaultValue={values.categoria ?? ""} onChange={submit}>
          <option value="">Todas</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="ordem" className="label">Ordenar por</label>
        <select id="ordem" name="ordem" className="field" defaultValue={values.ordem || "-created_at"} onChange={submit}>
          <option value="-created_at">Mais recentes</option>
          <option value="-priority">Prioridade</option>
          <option value="resolution_due_at">Prazo mais próximo</option>
          <option value="-updated_at">Atualizados</option>
        </select>
      </div>
      <div className="flex flex-wrap items-center gap-4 sm:col-span-2 lg:col-span-6">
        {staff && (
          <label className="flex items-center gap-2 text-sm">
            <span>Responsável:</span>
            <select name="responsavel" className="field w-auto" defaultValue={values.responsavel ?? ""} onChange={submit} aria-label="Responsável">
              <option value="">Qualquer</option>
              <option value="me">Meus chamados</option>
              <option value="none">Sem responsável</option>
            </select>
          </label>
        )}
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="atrasados" value="1" defaultChecked={values.atrasados === "1"} onChange={submit} />
          Só atrasados
        </label>
        <button type="submit" className="btn ml-auto">Filtrar</button>
      </div>
    </Form>
  );
}
