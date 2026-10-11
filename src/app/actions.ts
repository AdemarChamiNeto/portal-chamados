"use server";

import { refresh } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import QRCode from "qrcode";
import { z } from "zod";
import { ApiError } from "@/lib/api/contract";
import { backend } from "@/lib/server/backend";
import { blockedFor, clientIp, recordFailure, waitMessage } from "@/lib/server/rateLimit";
import { safeReturn } from "@/lib/redirect";
import {
  clearPending2fa, clearSession, readPending2fa, requireSession, saveSession, savePending2fa,
} from "@/lib/server/session";
import { CATEGORIES, LEVELS, STATUSES } from "@/lib/types";

/** Estado devolvido aos formulários (useActionState): mensagem geral + erros por campo. */
export interface FormState {
  ok?: boolean;
  error?: string;
  fields?: Record<string, string>;
  values?: Record<string, string>;
}

const values = (fd: FormData) => Object.fromEntries([...fd.entries()].map(([k, v]) => [k, String(v)]));

/**
 * Para onde voltar depois do login. O campo escondido "voltar" só existe depois que o JavaScript da página carrega;
 * se o formulário for enviado antes (rede lenta), usa o ?voltar= da própria página de login (Referer).
 * Sempre passa pelo safeReturn: só caminho interno.
 */
async function returnPath(fromForm: string | undefined): Promise<string> {
  if (fromForm) return safeReturn(fromForm);
  try {
    const referer = (await headers()).get("referer");
    return safeReturn(referer ? new URL(referer).searchParams.get("voltar") ?? undefined : undefined);
  } catch {
    return safeReturn(undefined);
  }
}

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
  const bucket = `login:${await clientIp()}`;
  const wait = blockedFor(bucket);
  if (wait) return { error: waitMessage(wait), values: { email: parsed.data.email } };

  let twoFactor = false;
  try {
    const r = await (await backend(null)).login(parsed.data.email, parsed.data.password);
    if (r.twoFactorRequired) {
      await savePending2fa(r.pendingToken);
      twoFactor = true;
    } else {
      await saveSession(r.token);
    }
  } catch (e) {
    if (e instanceof ApiError) {
      if (e.isUnauthorized) recordFailure(bucket);
      return { error: e.message, values: { email: parsed.data.email } };
    }
    throw e;
  }
  const voltar = await returnPath(parsed.data.voltar);
  redirect(twoFactor ? `/login/codigo?voltar=${encodeURIComponent(voltar)}` : voltar);
}

/** Segundo passo do login: código do app autenticador ou um código de recuperação. */
export async function loginSecondFactor(_prev: FormState, fd: FormData): Promise<FormState> {
  const code = String(fd.get("code") ?? "").trim();
  if (code.length < 6 || code.length > 20) return { fields: { code: "Digite o código de 6 dígitos ou um código de recuperação" } };
  const pending = await readPending2fa();
  if (!pending) redirect("/login?expirou=1");

  const bucket = `2fa:${await clientIp()}`;
  const wait = blockedFor(bucket);
  if (wait) return { error: waitMessage(wait) };
  try {
    const r = await (await backend(null)).loginSecondFactor(pending, code);
    await clearPending2fa();
    await saveSession(r.token);
  } catch (e) {
    if (e instanceof ApiError) {
      if (e.isUnauthorized) recordFailure(bucket);
      // token pendente vencido (5 min): recomeça pelo login
      if (e.code === "invalid_token") {
        await clearPending2fa();
        redirect("/login?expirou=1");
      }
      return { error: e.message };
    }
    throw e;
  }
  redirect(await returnPath(String(fd.get("voltar") ?? "") || undefined));
}

export async function logout() {
  await clearSession();
  await clearPending2fa();
  redirect("/login");
}

// ---- 2FA opcional (tela "Minha conta") ----

export interface TwoFactorState extends FormState {
  step?: "setup" | "codes";
  secret?: string;
  qr?: string;
  recoveryCodes?: string[];
}

/** Passo 1: gera o segredo e o QR code (imagem data: gerada no servidor). */
export async function setupTwoFactor(): Promise<TwoFactorState> {
  const { api } = await requireSession();
  try {
    const { secret, otpauthUrl } = await api.setupTwoFactor();
    const qr = await QRCode.toDataURL(otpauthUrl, { margin: 1, width: 200 });
    return { step: "setup", secret, qr };
  } catch (e) {
    if (e instanceof ApiError) return { error: e.message };
    throw e;
  }
}

/** Passo 2: confirma com o primeiro código e mostra os códigos de recuperação uma única vez. */
export async function enableTwoFactor(prev: TwoFactorState, fd: FormData): Promise<TwoFactorState> {
  const { api } = await requireSession();
  try {
    const { recoveryCodes } = await api.enableTwoFactor(String(fd.get("code") ?? "").trim());
    return { step: "codes", recoveryCodes };
  } catch (e) {
    if (e instanceof ApiError) return { ...prev, error: e.details.code ?? e.message };
    throw e;
  }
}

export async function disableTwoFactor(_prev: TwoFactorState, fd: FormData): Promise<TwoFactorState> {
  const { api } = await requireSession();
  try {
    await api.disableTwoFactor(String(fd.get("password") ?? ""), String(fd.get("code") ?? "").trim());
  } catch (e) {
    if (e instanceof ApiError) return { error: e.message };
    throw e;
  }
  refresh();
  return { ok: true };
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
