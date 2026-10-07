/**
 * Horário comercial em São Paulo: seg–sex, 08–12 e 13–18 (9 h/dia), sem feriados configurados.
 * Porte do BusinessCalendar da API em PHP, usado pelo modo demonstração.
 * São Paulo não tem horário de verão desde 2019, então o fuso é fixo em UTC−3.
 */
const OFFSET_MIN = -3 * 60;
const WINDOWS: [number, number][] = [[8 * 60, 12 * 60], [13 * 60, 18 * 60]];
const DAY = 86_400_000;

const toLocal = (d: Date) => new Date(d.getTime() + OFFSET_MIN * 60_000); // campos UTC = hora local
const fromLocal = (d: Date) => new Date(d.getTime() - OFFSET_MIN * 60_000);
const minuteOfDay = (local: Date) => local.getUTCHours() * 60 + local.getUTCMinutes();
const ymd = (local: Date) => local.toISOString().slice(0, 10);
const startOfDay = (local: Date) => new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()));

export class BusinessCalendar {
  private readonly holidays: Set<string>;

  constructor(holidays: string[] = []) {
    this.holidays = new Set(holidays);
  }

  private isWorkingLocalDay(local: Date) {
    const dow = local.getUTCDay();
    return dow >= 1 && dow <= 5 && !this.holidays.has(ymd(local));
  }

  isWorkingDay(d: Date) {
    return this.isWorkingLocalDay(toLocal(d));
  }

  addBusinessMinutes(start: Date, minutes: number): Date {
    if (minutes < 0) throw new RangeError("minutes deve ser >= 0");
    let day = startOfDay(toLocal(start));
    let now = minuteOfDay(toLocal(start));
    let left = minutes;
    for (let guard = 0; guard < 3660; guard++) {
      if (this.isWorkingLocalDay(day)) {
        for (const [from, to] of WINDOWS) {
          if (now >= to) continue;
          const begin = Math.max(now, from);
          const available = to - begin;
          if (left <= available) return fromLocal(new Date(day.getTime() + (begin + left) * 60_000));
          left -= available;
          now = to;
        }
      }
      day = new Date(day.getTime() + DAY);
      now = 0;
    }
    throw new Error("Calendário sem dias úteis");
  }

  businessMinutesBetween(from: Date, to: Date): number {
    if (to <= from) return 0;
    const a = toLocal(from), b = toLocal(to);
    let total = 0;
    for (let day = startOfDay(a); day <= b; day = new Date(day.getTime() + DAY)) {
      if (!this.isWorkingLocalDay(day)) continue;
      const start = ymd(day) === ymd(a) ? minuteOfDay(a) : 0;
      const end = ymd(day) === ymd(b) ? minuteOfDay(b) : 24 * 60;
      for (const [f, t] of WINDOWS) total += Math.max(0, Math.min(end, t) - Math.max(start, f));
    }
    return total;
  }
}
