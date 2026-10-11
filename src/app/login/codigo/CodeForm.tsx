"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useActionState } from "react";
import { loginSecondFactor, type FormState } from "@/app/actions";
import { FieldError } from "@/components/FieldError";
import { SubmitButton } from "@/components/SubmitButton";

function Voltar() {
  const voltar = useSearchParams().get("voltar");
  return voltar ? <input type="hidden" name="voltar" value={voltar} /> : null;
}

export function CodeForm() {
  const [state, action] = useActionState<FormState, FormData>(loginSecondFactor, {});
  return (
    <form action={action} className="grid gap-4" noValidate>
      <Suspense fallback={null}>
        <Voltar />
      </Suspense>
      {state.error && <p role="alert" className="rounded-lg border border-danger p-3 text-sm text-danger">{state.error}</p>}
      <div>
        <label htmlFor="code" className="label">Código</label>
        <input id="code" name="code" className="field font-mono" required autoFocus autoComplete="one-time-code"
          placeholder="123456" aria-invalid={!!state.fields?.code} aria-describedby="code-erro code-ajuda" />
        <p id="code-ajuda" className="mt-1 text-xs text-muted">Os 6 dígitos do app autenticador, ou um dos seus códigos de recuperação.</p>
        <FieldError id="code-erro" message={state.fields?.code} />
      </div>
      <SubmitButton pendingText="Conferindo…">Entrar</SubmitButton>
    </form>
  );
}
