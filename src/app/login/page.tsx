import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { LoginForm } from "./LoginForm";
import { DEMO_PASSWORD, DEMO_USERS } from "@/lib/api/demo";
import { ROLE_LABEL } from "@/lib/labels";
import { isDemo } from "@/lib/server/backend";

export const metadata: Metadata = { title: "Entrar" };

/** Lista os usuários fictícios só no modo demonstração (decidido na hora do request, não no build). */
async function UsuariosDemo() {
  await connection();
  if (!isDemo()) return null;
  return (
    <section className="card p-6" aria-labelledby="demo-titulo">
      <h2 id="demo-titulo" className="text-lg font-semibold">Usuários de demonstração</h2>
      <p className="mt-1 text-sm text-muted">
        Senha de todos: <code className="rounded bg-surface-2 px-1">{DEMO_PASSWORD}</code>. Dados fictícios, guardados em memória.
      </p>
      <ul className="mt-3 divide-y divide-line text-sm">
        {DEMO_USERS.map((u) => (
          <li key={u.id} className="flex justify-between gap-2 py-2">
            <span>{u.name} <span className="text-muted">({ROLE_LABEL[u.role]})</span></span>
            <code>{u.email}</code>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function LoginPage() {
  return (
    <div className="mx-auto grid max-w-4xl gap-6 md:grid-cols-2">
      <section className="card p-6">
        <h1 className="mb-4 text-2xl font-bold">Entrar</h1>
        <LoginForm />
      </section>
      <Suspense fallback={null}>
        <UsuariosDemo />
      </Suspense>
    </div>
  );
}
