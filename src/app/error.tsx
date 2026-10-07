"use client";

export default function Erro({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <div role="alert" className="card mx-auto max-w-md p-6 text-center">
      <h1 className="text-xl font-bold">Algo deu errado</h1>
      <p className="mt-2 text-muted">{error.message || "Erro ao carregar a página."}</p>
      <button type="button" className="btn mt-4" onClick={() => retry()}>Tentar de novo</button>
    </div>
  );
}
