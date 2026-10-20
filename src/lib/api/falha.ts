import { ApiError } from "./contract";

export interface FalhaDaApi {
  titulo: string;
  mensagem: string;
}

/**
 * Traduz uma falha da API (ou do caminho até ela) para o que o usuário precisa saber. Nulo para
 * o que não é falha da API (4xx de regra de negócio, redirect, notFound): esses seguem o caminho normal.
 *
 * As páginas mostram isto no lugar do conteúdo em vez de lançar o erro: em produção o Next.js
 * troca a mensagem de erro do servidor por um texto genérico, e o usuário ficaria sem saber o que houve.
 */
export function falhaDaApi(e: unknown): FalhaDaApi | null {
  if (!(e instanceof ApiError)) return null;
  const segundos = (ms: number | null) => Math.max(1, Math.ceil((ms ?? 1000) / 1000));

  if (e.code === "circuit_open") {
    return {
      titulo: "A API de chamados está instável",
      mensagem: `Para não piorar a situação, o portal pausou as consultas por alguns segundos. ${e.message.replace(/^A API está instável\. /, "")}`,
    };
  }
  if (e.status === 429) {
    return { titulo: "Muitas consultas seguidas", mensagem: `Espere ${segundos(e.retryAfterMs)} s e tente de novo.` };
  }
  if (e.code === "timeout") {
    return { titulo: "A API demorou demais para responder", mensagem: "O portal tentou mais de uma vez. Tente de novo em instantes." };
  }
  if (e.status >= 500) {
    return { titulo: "Não foi possível falar com a API de chamados", mensagem: "O portal tentou mais de uma vez. Se continuar, avise o suporte." };
  }
  return null;
}
