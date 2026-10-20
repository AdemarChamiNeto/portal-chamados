import type { Metadata } from "next";
import { Suspense } from "react";
import { ApiIndisponivel } from "@/components/ApiIndisponivel";
import { falhaDaApi } from "@/lib/api/falha";
import { ROLE_LABEL } from "@/lib/labels";
import { requireSession } from "@/lib/server/session";
import { TwoFactorPanel } from "./TwoFactorPanel";

export const metadata: Metadata = { title: "Minha conta", robots: { index: false } }; // área logada: fora da busca

async function Conta() {
  let user, enabled;
  try {
    const s = await requireSession();
    user = s.user;
    ({ enabled } = await s.api.twoFactorStatus());
  } catch (e) {
    const falha = falhaDaApi(e);
    if (falha) return <ApiIndisponivel {...falha} />;
    throw e;
  }
  return (
    <div className="grid gap-4">
      <section className="card p-6" aria-labelledby="perfil-titulo">
        <h2 id="perfil-titulo" className="mb-2 font-semibold">Perfil</h2>
        <p>{user.name} · <span className="text-muted">{ROLE_LABEL[user.role]}</span></p>
        <p className="text-sm text-muted">{user.email}</p>
      </section>
      <section className="card p-6" aria-labelledby="2fa-titulo">
        <h2 id="2fa-titulo" className="mb-2 font-semibold">Verificação em duas etapas</h2>
        <TwoFactorPanel enabled={enabled} />
      </section>
    </div>
  );
}

export default function ContaPage() {
  return (
    <>
      <h1 className="mb-4 text-2xl font-bold">Minha conta</h1>
      <Suspense fallback={<p className="card p-6 text-muted" role="status">Carregando…</p>}>
        <Conta />
      </Suspense>
    </>
  );
}
