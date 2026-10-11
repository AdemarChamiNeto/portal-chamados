import "server-only";
import { headers } from "next/headers";

/**
 * Freio contra força bruta no login e no código do 2FA, por IP de quem está no navegador.
 * A API também limita, mas ela só enxerga o IP deste servidor (o portal é um BFF), então o limite
 * por IP do usuário final fica aqui. Contador em memória: na Vercel cada instância tem o seu,
 * então é uma camada a mais, não a única (a API guarda os dela no banco).
 */
const g = globalThis as unknown as { __rateLimits?: Map<string, { start: number; hits: number }> };
const buckets = () => (g.__rateLimits ??= new Map());

export const LOGIN_LIMIT = { max: 5, windowMs: 15 * 60_000 };

/** IP do cliente: na Vercel o X-Forwarded-For é preenchido pela própria plataforma. */
export async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "local";
}

/** Segundos até liberar, ou 0 se ainda pode tentar. */
export function blockedFor(bucket: string, limit = LOGIN_LIMIT, now = Date.now()): number {
  const b = buckets().get(bucket);
  if (!b || now - b.start >= limit.windowMs) return 0;
  return b.hits >= limit.max ? Math.ceil((b.start + limit.windowMs - now) / 1000) : 0;
}

/** Conta uma tentativa errada. */
export function recordFailure(bucket: string, limit = LOGIN_LIMIT, now = Date.now()): void {
  const map = buckets();
  const b = map.get(bucket);
  if (!b || now - b.start >= limit.windowMs) map.set(bucket, { start: now, hits: 1 });
  else b.hits++;
  // não deixa o mapa crescer sem fim
  if (map.size > 10_000) for (const [k, v] of map) if (now - v.start >= limit.windowMs) map.delete(k);
}

export const waitMessage = (seconds: number) =>
  `Muitas tentativas. Tente de novo em ${Math.max(1, Math.ceil(seconds / 60))} min.`;
