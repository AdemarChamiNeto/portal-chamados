"use client";

import { useActionState, useState } from "react";
import { createTicket, type FormState } from "@/app/actions";
import { PriorityBadge } from "@/components/Badges";
import { FieldError } from "@/components/FieldError";
import { SubmitButton } from "@/components/SubmitButton";
import { CATEGORY_LABEL, formatMinutes } from "@/lib/labels";
import { SLA_TARGETS, priorityFromMatrix } from "@/lib/priority";
import { CATEGORIES, type Level } from "@/lib/types";

const IMPACT: { value: Level; label: string; hint: string }[] = [
  { value: "alto", label: "Alto", hint: "o setor inteiro ou um cliente está parado" },
  { value: "medio", label: "Médio", hint: "algumas pessoas ou um processo importante" },
  { value: "baixo", label: "Baixo", hint: "só eu, e há como contornar" },
];
const URGENCY: { value: Level; label: string; hint: string }[] = [
  { value: "alto", label: "Alta", hint: "precisa ser resolvido agora" },
  { value: "medio", label: "Média", hint: "ainda hoje" },
  { value: "baixo", label: "Baixa", hint: "pode esperar alguns dias" },
];

function LevelGroup({ name, legend, options, value, onChange, error }:
  { name: string; legend: string; options: typeof IMPACT; value: Level | ""; onChange: (v: Level) => void; error?: string }) {
  return (
    <fieldset aria-describedby={`${name}-erro`} aria-invalid={!!error}>
      <legend className="label">{legend}</legend>
      <div className="grid gap-2">
        {options.map((o) => (
          <label key={o.value} className="flex cursor-pointer items-start gap-2 rounded-lg border border-line p-2 has-checked:border-accent has-checked:bg-surface-2">
            <input type="radio" name={name} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} className="mt-1" />
            <span><strong className="text-sm">{o.label}</strong><span className="block text-xs text-muted">{o.hint}</span></span>
          </label>
        ))}
      </div>
      <FieldError id={`${name}-erro`} message={error} />
    </fieldset>
  );
}

export function NewTicketForm() {
  const [state, action] = useActionState<FormState, FormData>(createTicket, {});
  const [impact, setImpact] = useState<Level | "">((state.values?.impact as Level) ?? "");
  const [urgency, setUrgency] = useState<Level | "">((state.values?.urgency as Level) ?? "");
  const priority = impact && urgency ? priorityFromMatrix(impact, urgency) : null;
  const f = state.fields ?? {};

  return (
    <form action={action} className="card grid gap-4 p-5" noValidate>
      {state.error && <p role="alert" className="rounded-lg border border-danger p-3 text-sm text-danger">{state.error}</p>}
      <div>
        <label htmlFor="title" className="label">Título</label>
        <input id="title" name="title" className="field" maxLength={150} defaultValue={state.values?.title} placeholder="Ex.: Impressora do 2º andar não imprime"
          aria-invalid={!!f.title} aria-describedby="title-erro" />
        <FieldError id="title-erro" message={f.title} />
      </div>
      <div>
        <label htmlFor="description" className="label">Descrição</label>
        <textarea id="description" name="description" rows={5} className="field" defaultValue={state.values?.description}
          placeholder="O que aconteceu, desde quando, e se aparece alguma mensagem de erro" aria-invalid={!!f.description} aria-describedby="description-erro" />
        <FieldError id="description-erro" message={f.description} />
      </div>
      <div>
        <label htmlFor="category" className="label">Categoria</label>
        <select id="category" name="category" className="field" defaultValue={state.values?.category ?? ""} aria-invalid={!!f.category} aria-describedby="category-erro">
          <option value="" disabled>Escolha…</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
        </select>
        <FieldError id="category-erro" message={f.category} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <LevelGroup name="impact" legend="Impacto" options={IMPACT} value={impact} onChange={setImpact} error={f.impact} />
        <LevelGroup name="urgency" legend="Urgência" options={URGENCY} value={urgency} onChange={setUrgency} error={f.urgency} />
      </div>
      <div aria-live="polite" className="rounded-lg bg-surface-2 p-3 text-sm" data-testid="previa-prioridade">
        {priority ? (
          <span className="flex flex-wrap items-center gap-2">
            Prioridade calculada: <PriorityBadge priority={priority} />
            <span className="text-muted">
              resposta em até {formatMinutes(SLA_TARGETS[priority][0])}, solução em até {formatMinutes(SLA_TARGETS[priority][1])} (horário comercial)
            </span>
          </span>
        ) : (
          <span className="text-muted">Escolha o impacto e a urgência para ver a prioridade e os prazos.</span>
        )}
      </div>
      <SubmitButton pendingText="Abrindo…">Abrir chamado</SubmitButton>
    </form>
  );
}
