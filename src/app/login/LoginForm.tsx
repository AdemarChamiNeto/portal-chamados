"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useActionState } from "react";
import { login, type FormState } from "@/app/actions";
import { FieldError } from "@/components/FieldError";
import { SubmitButton } from "@/components/SubmitButton";

/** Lê ?voltar e ?expirou da URL no navegador, para o formulário em si fazer parte do HTML estático. */
function ParametrosDaUrl() {
  const sp = useSearchParams();
  const voltar = sp.get("voltar");
  return (
    <>
      {sp.get("expirou") && (
        <p role="status" className="rounded-lg border border-warn p-3 text-sm text-warn">Sua sessão expirou. Entre de novo.</p>
      )}
      {voltar && <input type="hidden" name="voltar" value={voltar} />}
    </>
  );
}

export function LoginForm() {
  const [state, action] = useActionState<FormState, FormData>(login, {});
  return (
    <form action={action} className="grid gap-4" noValidate>
      <Suspense fallback={null}>
        <ParametrosDaUrl />
      </Suspense>
      {state.error && <p role="alert" className="rounded-lg border border-danger p-3 text-sm text-danger">{state.error}</p>}
      <div>
        <label htmlFor="email" className="label">Email</label>
        <input id="email" name="email" type="email" autoComplete="username" className="field" required
          defaultValue={state.values?.email} aria-invalid={!!state.fields?.email} aria-describedby="email-erro" />
        <FieldError id="email-erro" message={state.fields?.email} />
      </div>
      <div>
        <label htmlFor="password" className="label">Senha</label>
        <input id="password" name="password" type="password" autoComplete="current-password" className="field" required
          aria-invalid={!!state.fields?.password} aria-describedby="password-erro" />
        <FieldError id="password-erro" message={state.fields?.password} />
      </div>
      <SubmitButton pendingText="Entrando…">Entrar</SubmitButton>
    </form>
  );
}
