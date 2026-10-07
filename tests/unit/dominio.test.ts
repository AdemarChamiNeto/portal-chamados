import { describe, expect, it } from "vitest";
import { BusinessCalendar } from "@/lib/calendar";
import { parseFilters, withPage } from "@/lib/filters";
import { formatMinutes } from "@/lib/labels";
import { priorityFromMatrix } from "@/lib/priority";

// horário de São Paulo (UTC−3) → Date
const sp = (s: string) => new Date(`${s}:00-03:00`);
const local = (d: Date) => new Date(d.getTime() - 3 * 3_600_000).toISOString().slice(0, 16).replace("T", " ");

describe("BusinessCalendar (mesmos casos da API em PHP)", () => {
  const cal = new BusinessCalendar(["2026-10-12"]);
  it.each([
    ["2026-10-07T09:00", 60, "2026-10-07 10:00"],
    ["2026-10-07T11:30", 60, "2026-10-07 13:30"], // atravessa o almoço
    ["2026-10-07T06:00", 15, "2026-10-07 08:15"], // antes do expediente
    ["2026-10-07T17:00", 120, "2026-10-08 09:00"], // vira o dia
    ["2026-10-02T17:30", 60, "2026-10-05 08:30"], // sexta → segunda
    ["2026-10-09T17:00", 120, "2026-10-13 09:00"], // pula o feriado
    ["2026-10-07T08:00", 540, "2026-10-07 18:00"], // dia inteiro = 9 h
  ])("%s + %i min = %s", (start, min, expected) => {
    expect(local(cal.addBusinessMinutes(sp(start), min))).toBe(expected);
  });

  it("minutos úteis entre dois instantes", () => {
    expect(cal.businessMinutesBetween(sp("2026-10-07T11:30"), sp("2026-10-07T13:30"))).toBe(60);
    expect(cal.businessMinutesBetween(sp("2026-10-09T17:00"), sp("2026-10-13T09:00"))).toBe(120);
    expect(cal.businessMinutesBetween(sp("2026-10-08T10:00"), sp("2026-10-07T10:00"))).toBe(0);
  });

  it("somar e medir são inversos", () => {
    const start = sp("2026-10-07T10:17");
    for (const m of [1, 59, 223, 540, 1000, 3333]) expect(cal.businessMinutesBetween(start, cal.addBusinessMinutes(start, m))).toBe(m);
  });
});

describe("prioridade ITIL", () => {
  it("impacto × urgência", () => {
    expect(priorityFromMatrix("alto", "alto")).toBe("critica");
    expect(priorityFromMatrix("alto", "medio")).toBe("alta");
    expect(priorityFromMatrix("medio", "medio")).toBe("media");
    expect(priorityFromMatrix("baixo", "alto")).toBe("media");
    expect(priorityFromMatrix("medio", "baixo")).toBe("baixa");
  });
});

describe("filtros da URL", () => {
  it("padrão é só em andamento; 'todos' desliga", () => {
    expect(parseFilters({}).status).toEqual(["aberto", "em_atendimento", "aguardando_usuario"]);
    expect(parseFilters({ status: "todos" }).status).toBeUndefined();
  });

  it("converte e ignora valores inválidos", () => {
    expect(parseFilters({ status: "aberto,xyz", prioridade: "critica,urgente", categoria: "nada", responsavel: "me", atrasados: "1", ordem: "-priority", pagina: "3", q: "  vpn " }))
      .toEqual({ status: ["aberto"], priority: ["critica"], assignee: "me", overdue: true, sort: "-priority", page: 3, q: "vpn" });
    expect(parseFilters({ ordem: "senha", pagina: "-1" })).toEqual({ status: ["aberto", "em_atendimento", "aguardando_usuario"] });
  });

  it("links de página mantêm a busca", () => {
    expect(withPage({ q: "vpn", pagina: "2" }, 3)).toBe("?q=vpn&pagina=3");
    expect(withPage({ q: "vpn", pagina: "2" }, 1)).toBe("?q=vpn");
  });
});

describe("formatMinutes", () => {
  it.each([[0, "0 min"], [45, "45 min"], [75, "1 h 15 min"], [540, "1 dia útil"], [1125, "2 dias úteis 45 min"], [-60, "1 h"]])("%i → %s", (m, s) => {
    expect(formatMinutes(m)).toBe(s);
  });
});
