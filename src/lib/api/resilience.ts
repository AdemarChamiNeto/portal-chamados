/**
 * Como o cliente da API reage a falhas (testado contra o Chaos Proxy):
 * - repete só GET/HEAD (repetir um POST poderia abrir o chamado duas vezes);
 * - repete só o que pode passar sozinho: rede, timeout, 502/503/504 e resposta que não é JSON;
 * - espera crescente com sorteio (para várias requisições não voltarem todas juntas);
 * - respeita o Retry-After do 429 se a espera for curta; se for longa, avisa o usuário;
 * - circuit breaker: depois de várias falhas seguidas, para de bater na API por um tempo.
 * Relógio, espera e sorteio são injetáveis, então os testes rodam sem esperar de verdade.
 */

export interface ResilienceOptions {
  /** Timeout de cada tentativa de GET (ms). */
  readTimeoutMs: number;
  /** Timeout de POST/PATCH, que têm uma tentativa só (ms). */
  writeTimeoutMs: number;
  /** Novas tentativas em GET, além da primeira. */
  retries: number;
  /** Tempo total máximo de um GET, somando tentativas e esperas (ms). */
  budgetMs: number;
  /** Espera base entre tentativas (ms): base·2ⁿ + sorteio de até base. */
  baseDelayMs: number;
  /** Maior Retry-After que vale a pena esperar (ms). Acima disso, o erro vai para a tela. */
  maxRetryAfterMs: number;
  breaker: CircuitBreaker | null;
  sleep: (ms: number) => Promise<void>;
  random: () => number;
  now: () => number;
}

export const defaultResilience = (breaker: CircuitBreaker | null): ResilienceOptions => ({
  readTimeoutMs: 4000,
  writeTimeoutMs: 8000,
  retries: 2,
  budgetMs: 9000,
  baseDelayMs: 200,
  maxRetryAfterMs: 2000,
  breaker,
  sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
  random: Math.random,
  now: Date.now,
});

/** Espera antes da tentativa n (0 = antes da 2ª). */
export const backoff = (n: number, o: Pick<ResilienceOptions, "baseDelayMs" | "random">) =>
  Math.round(o.baseDelayMs * 2 ** n + o.random() * o.baseDelayMs);

/** Retry-After em segundos ou data HTTP → ms (nulo se ausente ou inválido). */
export function retryAfterMs(header: string | null, now: number): number | null {
  if (!header) return null;
  const s = Number(header);
  if (Number.isFinite(s) && s >= 0) return s * 1000;
  const at = Date.parse(header);
  return Number.isNaN(at) ? null : Math.max(0, at - now);
}

/**
 * Fechado: passa tudo. Depois de `threshold` falhas seguidas, abre: recusa na hora por `openMs`.
 * Passado esse tempo, deixa UMA requisição testar (meio-aberto): se der certo fecha, se falhar abre de novo.
 */
export class CircuitBreaker {
  private failures = 0;
  private openedAt: number | null = null;
  private probing = false;

  constructor(
    private readonly threshold = 5,
    private readonly openMs = 15_000,
    private readonly now: () => number = Date.now,
  ) {}

  /** Nulo se pode tentar; senão, quantos ms faltam para tentar de novo. */
  check(): number | null {
    if (this.openedAt === null) return null;
    const left = this.openedAt + this.openMs - this.now();
    if (left > 0) return left;
    if (this.probing) return 1000; // já tem uma requisição testando a API
    this.probing = true;
    return null;
  }

  success() {
    this.failures = 0;
    this.openedAt = null;
    this.probing = false;
  }

  failure() {
    this.failures++;
    this.probing = false;
    if (this.openedAt !== null || this.failures >= this.threshold) this.openedAt = this.now();
  }

  get state(): "fechado" | "aberto" | "meio-aberto" {
    if (this.openedAt === null) return "fechado";
    return this.openedAt + this.openMs > this.now() ? "aberto" : "meio-aberto";
  }
}
