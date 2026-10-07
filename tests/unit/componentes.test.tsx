import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SlaIndicator } from "@/components/Badges";

// os formulários importam Server Actions; no teste trocamos por funções vazias
vi.mock("@/app/actions", () => ({
  createTicket: vi.fn(async () => ({})),
  changeStatus: vi.fn(async () => ({})),
  addComment: vi.fn(async () => ({})),
  assignToMe: vi.fn(async () => ({})),
}));

const { NewTicketForm } = await import("@/app/chamados/novo/NewTicketForm");
const { StatusForm } = await import("@/app/chamados/[id]/TicketActions");

const sla = { response_due_at: "", resolution_due_at: "", paused: false, response_breached: false, resolution_breached: false };

describe("SlaIndicator", () => {
  it("mostra pausa, atraso e tempo restante", () => {
    const { rerender } = render(<SlaIndicator status="em_atendimento" sla={{ ...sla, paused: true, business_minutes_left: null }} />);
    expect(screen.getByText(/SLA pausado/)).toBeInTheDocument();
    rerender(<SlaIndicator status="em_atendimento" sla={{ ...sla, business_minutes_left: -90 }} />);
    expect(screen.getByText("Atrasado 1 h 30 min")).toBeInTheDocument();
    rerender(<SlaIndicator status="aberto" sla={{ ...sla, business_minutes_left: 45 }} />);
    expect(screen.getByText("Faltam 45 min")).toHaveClass("text-warn");
  });
});

describe("NewTicketForm", () => {
  it("prévia da prioridade muda com impacto e urgência", async () => {
    render(<NewTicketForm />);
    const previa = screen.getByTestId("previa-prioridade");
    expect(previa).toHaveTextContent("Escolha o impacto e a urgência");
    const [impactoAlto] = screen.getAllByRole("radio", { name: /^Alto/ });
    await userEvent.click(impactoAlto);
    await userEvent.click(screen.getByRole("radio", { name: /^Alta/ }));
    expect(previa).toHaveTextContent("Crítica");
    expect(previa).toHaveTextContent("resposta em até 30 min, solução em até 4 h");
    await userEvent.click(screen.getByRole("radio", { name: /^Baixa/ }));
    expect(previa).toHaveTextContent("Média");
  });
});

describe("StatusForm", () => {
  it("nota vira obrigatória só nos status que pedem", async () => {
    render(<StatusForm id={1} allowed={["aguardando_usuario", "resolvido", "em_atendimento"]} />);
    const nota = screen.getByLabelText(/Nota/);
    expect(nota).toBeRequired();
    await userEvent.selectOptions(screen.getByLabelText("Novo status"), "em_atendimento");
    expect(screen.getByLabelText(/Nota/)).not.toBeRequired();
    expect(screen.getByRole("button", { name: "Atender" })).toBeInTheDocument();
  });
});
