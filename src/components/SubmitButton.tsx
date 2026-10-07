"use client";

import { useFormStatus } from "react-dom";

/** Botão que se desabilita e muda o texto enquanto o formulário está enviando. */
export function SubmitButton({ children, pendingText = "Enviando…", className = "btn btn-primary", ...rest }:
  React.ButtonHTMLAttributes<HTMLButtonElement> & { pendingText?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" {...rest} className={className} disabled={pending || rest.disabled} aria-busy={pending}>
      {pending ? pendingText : children}
    </button>
  );
}
