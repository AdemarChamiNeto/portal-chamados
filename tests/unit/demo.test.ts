import { beforeEach, describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api/contract";
import { DemoChamadosApi, DemoStore, seedDemo } from "@/lib/api/demo";

// quarta-feira, 09:00 em São Paulo
let now: Date;
let store: DemoStore;
const as = (id: number) => new DemoChamadosApi(store, id);
const novo = (impact = "medio", urgency = "medio") =>
  as(4).createTicket({ title: "Computador não liga", description: "Apertei o botão e nada acontece.", category: "hardware", impact: impact as never, urgency: urgency as never });

beforeEach(() => {
  now = new Date("2026-10-07T12:00:00Z");
  store = new DemoStore(() => now);
});

describe("modo demonstração segue as regras da API", () => {
  it("prioridade e prazos em horário comercial", async () => {
    const t = await novo("alto", "medio");
    expect(t.priority).toBe("alta");
    expect(t.sla.response_due_at).toBe("2026-10-07T13:00:00Z");
    expect(t.sla.resolution_due_at).toBe("2026-10-08T12:00:00Z");
    expect(t.allowed_status).toEqual(["cancelado"]);
  });

  it("solicitante só vê os próprios chamados (404 nos outros)", async () => {
    const t = await novo();
    await expect(as(5).getTicket(t.id)).rejects.toMatchObject({ status: 404 });
    expect((await as(5).listTickets({})).meta.total).toBe(0);
    expect((await as(2).listTickets({})).meta.total).toBe(1);
  });

  it("transição inválida e nota obrigatória", async () => {
    const t = await novo();
    await expect(as(2).changeStatus(t.id, "resolvido", "pulando etapas")).rejects.toMatchObject({ status: 409, code: "invalid_transition" });
    await as(2).changeStatus(t.id, "em_atendimento");
    await expect(as(2).changeStatus(t.id, "resolvido")).rejects.toMatchObject({ status: 422, details: { note: expect.any(String) } });
  });

  it("quem atende vira responsável; pausa empurra o prazo", async () => {
    const t = await novo();
    const atendido = await as(2).changeStatus(t.id, "em_atendimento");
    expect(atendido.assignee?.name).toBe("Bruno Técnico");
    expect(atendido.first_response_at).toBe("2026-10-07T12:00:00Z");

    const pausado = await as(2).changeStatus(t.id, "aguardando_usuario", "Qual o patrimônio?");
    expect(pausado.sla.paused).toBe(true);
    now = new Date("2026-10-07T16:00:00Z"); // 3 h úteis depois (com almoço)
    const retomado = await as(4).comment(t.id, "É o PAT-999", false);
    expect(retomado.status).toBe("em_atendimento");
    expect(retomado.sla.resolution_due_at).toBe("2026-10-09T15:00:00Z");
  });

  it("comentário interno some para o solicitante", async () => {
    const t = await novo();
    await as(2).comment(t.id, "Suspeita de fonte queimada", true);
    await as(2).comment(t.id, "Vamos verificar hoje.", false);
    expect((await as(3).getTicket(t.id)).comments).toHaveLength(2);
    expect((await as(4).getTicket(t.id)).comments.map((c) => c.body)).toEqual(["Vamos verificar hoje."]);
    await expect(as(4).comment(t.id, "x", true)).rejects.toBeInstanceOf(ApiError);
  });

  it("filtro de atrasados e indicadores", async () => {
    const t = await novo("alto", "alto"); // crítico: 4 h úteis
    now = new Date("2026-10-07T18:00:00Z");
    const lista = await as(2).listTickets({ overdue: true });
    expect(lista.data.map((x) => x.id)).toEqual([t.id]);
    expect(lista.data[0].sla.business_minutes_left).toBe(-60);
    expect((await as(1).metrics()).overdue).toBe(1);
    await expect(as(4).metrics()).rejects.toMatchObject({ status: 403 });
  });

  it("dados de demonstração são criados pelas próprias regras", async () => {
    await seedDemo(store, new Date("2026-10-07T22:00:00Z"));
    const todos = await as(1).listTickets({ per_page: 100 });
    expect(todos.meta.total).toBe(6);
    expect(todos.data.some((t) => t.sla.paused)).toBe(true);
    expect(todos.data.some((t) => t.status === "fechado")).toBe(true);
  });

  it("login de demonstração", async () => {
    const anon = new DemoChamadosApi(store);
    await expect(anon.login("bruno@exemplo.com", "errada")).rejects.toMatchObject({ status: 401 });
    expect((await anon.login(" BRUNO@exemplo.com", "senha-demo-123")).token).toBe("demo.2");
    await expect(anon.me()).rejects.toMatchObject({ status: 401 });
  });
});
