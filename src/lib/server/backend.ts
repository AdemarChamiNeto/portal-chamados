import "server-only";
import { connection } from "next/server";
import { DemoChamadosApi, DemoStore, seedDemo } from "../api/demo";
import { HttpChamadosApi } from "../api/http";
import type { ChamadosApi } from "../api/contract";

/** Sem CHAMADOS_API_URL o portal roda em modo demonstração (dados fictícios em memória). */
export const apiUrl = () => process.env.CHAMADOS_API_URL?.replace(/\/$/, "") || null;
export const isDemo = () => apiUrl() === null;

// Guardado em globalThis para sobreviver ao hot reload do `next dev`.
const g = globalThis as unknown as { __demoStore?: Promise<DemoStore> };

async function demoStore() {
  g.__demoStore ??= (async () => {
    const store = new DemoStore();
    await seedDemo(store, new Date());
    return store;
  })();
  return g.__demoStore;
}

/** Cliente da API para um token (ou anônimo, para o login). */
export async function backend(token: string | null): Promise<ChamadosApi> {
  // a API (real ou demo) depende do horário e do usuário: sempre na hora do request, nunca no prerender
  await connection();
  const url = apiUrl();
  if (url) return new HttpChamadosApi(url, token);
  const id = token?.startsWith("demo.") ? Number(token.slice(5)) : null;
  return new DemoChamadosApi(await demoStore(), Number.isInteger(id) ? id : null);
}
