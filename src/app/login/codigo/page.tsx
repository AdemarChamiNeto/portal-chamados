import type { Metadata } from "next";
import Link from "next/link";
import { CodeForm } from "./CodeForm";

export const metadata: Metadata = { title: "Verificação em duas etapas", robots: { index: false } };

export default function CodigoPage() {
  return (
    <section className="card mx-auto max-w-md p-6">
      <h1 className="mb-1 text-2xl font-bold">Verificação em duas etapas</h1>
      <p className="mb-4 text-sm text-muted">Sua conta pede um código além da senha.</p>
      <CodeForm />
      <p className="mt-4 text-center text-sm">
        <Link href="/login" className="text-muted hover:underline">Voltar para o login</Link>
      </p>
    </section>
  );
}
