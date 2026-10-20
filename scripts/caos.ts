/**
 * Mede como o cliente da API se comporta em cada cenário do Chaos Proxy: o cliente antigo
 * (uma tentativa, timeout de 8 s) contra o atual (retry, Retry-After e circuit breaker).
 *
 * Precisa do ambiente do repositório chaos-proxy no ar (docker compose up -d): API de Chamados
 * na 8080 e o proxy na 8081. Uso:
 *   CAOS_ADMIN_TOKEN=... npx tsx scripts/caos.ts
 * Login com um usuário de demonstração do seed da API (CAOS_EMAIL / CAOS_SENHA).
 */
import { HttpChamadosApi } from "../src/lib/api/http";
import { CircuitBreaker } from "../src/lib/api/resilience";

const PROXY = process.env.CAOS_PROXY ?? "http://localhost:8081";
const ADMIN = process.env.CAOS_ADMIN_TOKEN ?? "token-local-de-desenvolvimento-com-32-caracteres";
const EMAIL = process.env.CAOS_EMAIL ?? "bruno@exemplo.com";
const SENHA = process.env.CAOS_SENHA;
const TOTAL = Number(process.env.CAOS_TOTAL ?? 30);
const PARALELO = 3;
const CENARIOS = ["normal", "lenta", "instavel", "fora", "travada", "limite", "html"];

if (!SENHA) {
  console.error("Defina CAOS_SENHA (a senha do usuário de demonstração do seed da API).");
  process.exit(1);
}

async function cenario(nome: string) {
  const r = await fetch(`${PROXY}/_chaos/rules/scenario/${nome}`, { method: "PUT", headers: { Authorization: `Bearer ${ADMIN}` } });
  if (!r.ok) throw new Error(`Não consegui aplicar o cenário ${nome}: ${r.status}`);
}

const percentil = (v: number[], p: number) => [...v].sort((a, b) => a - b)[Math.max(0, Math.ceil((p / 100) * v.length) - 1)] ?? 0;

async function rodar(api: HttpChamadosApi, chamadas: { n: number }) {
  const tempos: number[] = [];
  let ok = 0;
  const erros = new Map<string, number>();
  let proxima = 0;
  const inicio = performance.now();
  await Promise.all(Array.from({ length: PARALELO }, async () => {
    while (proxima < TOTAL) {
      proxima++;
      const t = performance.now();
      try {
        await api.listTickets({});
        ok++;
      } catch (e) {
        const code = (e as { code?: string }).code ?? "?";
        erros.set(code, (erros.get(code) ?? 0) + 1);
      }
      tempos.push(performance.now() - t);
    }
  }));
  return {
    ok,
    p50: percentil(tempos, 50),
    p95: percentil(tempos, 95),
    total: performance.now() - inicio,
    chamadas: chamadas.n,
    erros: [...erros].map(([k, v]) => `${k} ${v}`).join(", ") || "—",
  };
}

async function main() {
  await cenario("normal");
  const login = await new HttpChamadosApi(PROXY, null).login(EMAIL, SENHA!);
  if (login.twoFactorRequired) throw new Error("Use um usuário sem 2FA");
  const token = login.token;

  const linhas: string[] = [];
  for (const nome of CENARIOS) {
    for (const tipo of ["antigo", "atual"] as const) {
      await cenario(nome);
      if (nome === "limite") await new Promise((r) => setTimeout(r, 5500)); // janela do rate limit zerada
      const chamadas = { n: 0 };
      const contando: typeof fetch = (input, init) => {
        chamadas.n++;
        return fetch(input, init);
      };
      const api = tipo === "antigo"
        ? new HttpChamadosApi(PROXY, token, contando, { retries: 0, breaker: null, readTimeoutMs: 8000, writeTimeoutMs: 8000, budgetMs: 8000 })
        : new HttpChamadosApi(PROXY, token, contando, { breaker: new CircuitBreaker() });
      const r = await rodar(api, chamadas);
      const linha = `| ${nome} | ${tipo} | ${r.ok}/${TOTAL} | ${Math.round(r.p50)} ms | ${Math.round(r.p95)} ms | ${(r.total / 1000).toFixed(1)} s | ${r.chamadas} | ${r.erros} |`;
      console.log(linha);
      linhas.push(linha);
    }
  }
  await cenario("normal");
  await fetch(`${PROXY}/_chaos/rules`, { method: "DELETE", headers: { Authorization: `Bearer ${ADMIN}` } });

  console.log("\n| Cenário | Cliente | Deram certo | p50 | p95 | Tempo total | Chamadas à API | Erros |\n|---|---|---|---|---|---|---|---|");
  console.log(linhas.join("\n"));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
