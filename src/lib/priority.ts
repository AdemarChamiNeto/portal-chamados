import type { Level, Priority } from "./types";

const WEIGHT: Record<Level, number> = { alto: 3, medio: 2, baixo: 1 };

/** Matriz impacto × urgência (ITIL) — a mesma regra da API, usada aqui para a prévia no formulário. */
export function priorityFromMatrix(impact: Level, urgency: Level): Priority {
  const sum = WEIGHT[impact] + WEIGHT[urgency];
  if (sum === 6) return "critica";
  if (sum === 5) return "alta";
  if (sum === 4) return "media";
  return "baixa";
}

/** Metas de SLA em minutos úteis: [primeira resposta, solução]. */
export const SLA_TARGETS: Record<Priority, [number, number]> = {
  critica: [30, 4 * 60],
  alta: [60, 9 * 60],
  media: [4 * 60, 18 * 60],
  baixa: [9 * 60, 45 * 60],
};

export const PRIORITY_WEIGHT: Record<Priority, number> = { critica: 4, alta: 3, media: 2, baixa: 1 };
