"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { ApiError } from "@/lib/api/contract";
import { backend } from "@/lib/server/backend";
import { clearSession, requireSession, saveSession } from "@/lib/server/session";
import { CATEGORIES, LEVELS, STATUSES } from "@/lib/types";

/** Estado devolvido aos formulários (useActionState): mensagem geral + erros por campo. */
export interface FormState {
  ok?: boolean;
  error?: string;
  fields?: Record<string, string>;
  values?: Record<string, string>;
}

const values = (fd: FormData) => Object.fromEntries([...fd.entries()].map(([k, v]) => [k, String(v)]));

/** Converte erros da API em estado de formulário; sessão expirada vai para o login. */
async function fail(e: unknown, fd: FormData): Promise<FormState> {
  if (e instanceof ApiError) {
    if (e.isUnauthorized) {
      await clearSession();
      redirect("/login?expirou=1");
    }
    return { error: e.message, fields: e.details, values: values(fd) };
  }
  throw e;
}

/** Só aceita caminhos internos no "voltar" (evita open redirect para outro site). */
const safeReturn = (path: string | undefined) => (path && /^\/(?!\/)/.test(path) ? path : "/chamados");

const loginSchema = z.object({
  email: z.email("Informe um email válido"),
  password: z.string().min(1, "Informe a senha"),
  voltar: z.string().optional(),
});

export async function login(_prev: FormState, fd: FormData): Promise<FormState> {
  const parsed = loginSchema.safeParse(values(fd));
  if (!parsed.success) {
    return { fields: Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])), values: { email: String(fd.get("email") ?? "") } };
  }
  try {
    const { token } = await (await backend(null)).login(parsed.data.email, parsed.data.password);
    await saveSession(token);
  } catch (e) {
    if (e instanceof ApiError) return { error: e.message, values: { email: parsed.data.email } };
    throw e;
  }
  redirect(safeReturn(parsed.data.voltar));
}

export async function logout() {
  await clearSession();
  redirect("/login");
}

const ticketSchema = z.object({
  title: z.string().trim().min(5, "Mínimo de 5 caracteres").max(150, "Máximo de 150 caracteres"),
  description: z.string().trim().min(10, "Descreva com pelo menos 10 caracteres").max(5000),
  category: z.enum(CATEGORIES, "Escolha a categoria"),
  impact: z.enum(LEVELS, "Escolha o impacto"),
  urgency: z.enum(LEVELS, "Escolha a urgência"),
});

export async function createTicket(_prev: FormState, fd: FormData): Promise<FormState> {
  const { api } = await requireSession();
  const parsed = ticketSchema.safeParse(values(fd));
  if (!parsed.success) {
    return { fields: Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])), values: values(fd) };
  }
  let id: number;
  try {
    id = (await api.createTicket(parsed.data)).id;
  } catch (e) {
    return fail(e, fd);
  }
  redirect(`/chamados/${id}?novo=1`);
}

const statusSchema = z.object({ id: z.coerce.number().int().positive(), status: z.enum(STATUSES), note: z.string().optional() });

export async function changeStatus(_prev: FormState, fd: FormData): Promise<FormState> {
  const { api } = await requireSession();
  const parsed = statusSchema.safeParse(values(fd));
  if (!parsed.success) return { error: "Requisição inválida" };
  try {
    await api.changeStatus(parsed.data.id, parsed.data.status, parsed.data.note?.trim() || undefined);
  } catch (e) {
    return fail(e, fd);
  }
  refresh(); // dados da API não são cacheados: re-renderiza a página com o chamado atualizado
  return { ok: true };
}

export async function addComment(_prev: FormState, fd: FormData): Promise<FormState> {
  const { api } = await requireSession();
  const id = Number(fd.get("id"));
  try {
    await api.comment(id, String(fd.get("body") ?? ""), fd.get("internal") === "on");
  } catch (e) {
    return fail(e, fd);
  }
  refresh();
  return { ok: true };
}

export async function assignToMe(_prev: FormState, fd: FormData): Promise<FormState> {
  const { api, user } = await requireSession();
  try {
    await api.assign(Number(fd.get("id")), fd.get("release") === "1" ? null : user.id);
  } catch (e) {
    return fail(e, fd);
  }
  refresh();
  return { ok: true };
}
