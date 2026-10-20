"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import type { FalhaDaApi } from "@/lib/api/falha";

/** Aviso no lugar do conteúdo quando a API falha, com "tentar de novo" que recarrega só os dados. */
export function ApiIndisponivel({ titulo, mensagem }: FalhaDaApi) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <div role="alert" className="card mx-auto max-w-lg p-6 text-center">
      <h2 className="text-lg font-bold">{titulo}</h2>
      <p className="mt-2 text-muted">{mensagem}</p>
      <button type="button" className="btn mt-4" disabled={pending} onClick={() => startTransition(() => router.refresh())}>
        {pending ? "Tentando…" : "Tentar de novo"}
      </button>
    </div>
  );
}
