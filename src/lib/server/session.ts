import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { ApiError, type ChamadosApi } from "../api/contract";
import type { User } from "../types";
import { backend } from "./backend";

export const SESSION_COOKIE = "chamados_session";
const MAX_AGE = 8 * 60 * 60; // igual à validade do JWT da API

/**
 * O token da API fica num cookie httpOnly: o JavaScript do navegador não consegue ler,
 * então um XSS não rouba a sessão. Todas as chamadas à API saem do servidor do Next.
 */
export async function saveSession(token: string) {
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function clearSession() {
  (await cookies()).delete(SESSION_COOKIE);
}

export interface Session {
  user: User;
  api: ChamadosApi;
}

/**
 * Data Access Layer: valida a sessão perguntando à API quem é o usuário (o token pode ter expirado
 * ou a conta ter sido desativada). Memorizado por request com `cache`, então várias partes da página
 * podem chamar sem repetir a requisição.
 */
export const getSession = cache(async (): Promise<Session | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value ?? null;
  if (!token) return null;
  const api = await backend(token);
  try {
    return { user: await api.me(), api };
  } catch (e) {
    if (e instanceof ApiError && e.isUnauthorized) return null;
    throw e;
  }
});

export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) redirect("/login?expirou=1");
  return session;
}
