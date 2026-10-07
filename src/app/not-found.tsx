import Link from "next/link";

export default function NotFound() {
  return (
    <div className="card mx-auto max-w-md p-6 text-center">
      <h1 className="text-xl font-bold">Não encontrado</h1>
      <p className="mt-2 text-muted">O chamado não existe ou você não tem acesso a ele.</p>
      <Link href="/chamados" className="btn mt-4">Voltar para a fila</Link>
    </div>
  );
}
