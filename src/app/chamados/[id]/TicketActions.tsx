"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { addComment, assignToMe, changeStatus, type FormState } from "@/app/actions";
import { FieldError } from "@/components/FieldError";
import { SubmitButton } from "@/components/SubmitButton";
import { NOTE_REQUIRED, STATUS_ACTION, STATUS_LABEL } from "@/lib/labels";
import type { Status } from "@/lib/types";

function ErrorBox({ state }: { state: FormState }) {
  return state.error ? <p role="alert" className="rounded-lg border border-danger p-2 text-sm text-danger">{state.error}</p> : null;
}

/** Mudança de status: mostra só as transições que a API permite para o usuário e exige nota quando a regra pede. */
export function StatusForm({ id, allowed }: { id: number; allowed: Status[] }) {
  const [state, action] = useActionState<FormState, FormData>(changeStatus, {});
  const [status, setStatus] = useState<Status>(allowed[0]);
  const needsNote = NOTE_REQUIRED.includes(status);
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state.ok) form.current?.reset(); }, [state]);

  return (
    <form ref={form} action={action} className="grid gap-2" aria-label="Mudar status">
      <input type="hidden" name="id" value={id} />
      <ErrorBox state={state} />
      <label htmlFor="novo-status" className="label">Novo status</label>
      <select id="novo-status" name="status" className="field" value={status} onChange={(e) => setStatus(e.target.value as Status)}>
        {allowed.map((s) => <option key={s} value={s}>{STATUS_ACTION[s]} ({STATUS_LABEL[s]})</option>)}
      </select>
      <label htmlFor="nota" className="label">
        Nota {needsNote ? <span className="text-danger">(obrigatória)</span> : <span className="text-muted">(opcional)</span>}
      </label>
      <textarea id="nota" name="note" rows={3} className="field" required={needsNote} minLength={needsNote ? 5 : undefined}
        aria-invalid={!!state.fields?.note} aria-describedby="nota-erro nota-dica"
        placeholder={status === "resolvido" ? "O que foi feito para resolver" : status === "aguardando_usuario" ? "O que você precisa do solicitante" : ""} />
      <p id="nota-dica" className="text-xs text-muted">A nota aparece para o solicitante na conversa.</p>
      <FieldError id="nota-erro" message={state.fields?.note} />
      <SubmitButton pendingText="Salvando…">{STATUS_ACTION[status]}</SubmitButton>
    </form>
  );
}

export function CommentForm({ id, staff }: { id: number; staff: boolean }) {
  const [state, action] = useActionState<FormState, FormData>(addComment, {});
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state.ok) form.current?.reset(); }, [state]);

  return (
    <form ref={form} action={action} className="mt-4 grid gap-2" aria-label="Comentar">
      <input type="hidden" name="id" value={id} />
      <ErrorBox state={state} />
      <label htmlFor="comentario" className="label">Comentar</label>
      <textarea id="comentario" name="body" rows={3} required className="field" aria-invalid={!!state.fields?.body} aria-describedby="comentario-erro" />
      <FieldError id="comentario-erro" message={state.fields?.body} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        {staff ? (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="internal" /> Comentário interno (o solicitante não vê)
          </label>
        ) : <span />}
        <SubmitButton pendingText="Enviando…">Enviar</SubmitButton>
      </div>
    </form>
  );
}

export function AssignForm({ id, mine, canRelease, hasAssignee }: { id: number; mine: boolean; canRelease: boolean; hasAssignee: boolean }) {
  const [state, action] = useActionState<FormState, FormData>(assignToMe, {});
  if (hasAssignee && !canRelease && !mine) return null;
  return (
    <form action={action} className="grid gap-2">
      <input type="hidden" name="id" value={id} />
      {mine && <input type="hidden" name="release" value="1" />}
      <ErrorBox state={state} />
      <SubmitButton className="btn" pendingText="Salvando…">{mine ? "Largar o chamado" : "Assumir o chamado"}</SubmitButton>
    </form>
  );
}
