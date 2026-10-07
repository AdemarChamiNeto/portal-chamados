import type { Metadata } from "next";
import { NewTicketForm } from "./NewTicketForm";

export const metadata: Metadata = { title: "Abrir chamado" };

export default function NovoChamadoPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-1 text-2xl font-bold">Abrir chamado</h1>
      <p className="mb-4 text-muted">Você informa o impacto e a urgência; a prioridade e os prazos são calculados pela matriz ITIL.</p>
      <NewTicketForm />
    </div>
  );
}
