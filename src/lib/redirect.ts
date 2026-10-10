const BASE = "http://portal.invalid";

/**
 * Só aceita caminhos internos no "voltar" do login (evita open redirect para outro site).
 *
 * Não basta olhar se começa com "/": o navegador trata "\" como "/" e ignora TAB e quebra de linha,
 * então "/\site.com" e "/\t/site.com" viram "//site.com" (outro domínio). Por isso o caminho é
 * interpretado pelo mesmo parser de URL do navegador e só passa se continuar na mesma origem.
 */
export function safeReturn(path: string | undefined, fallback = "/chamados"): string {
  if (!path || !path.startsWith("/") || /[\\\u0000-\u001f\u007f]/.test(path)) return fallback;
  try {
    const url = new URL(path, BASE);
    return url.origin === BASE ? url.pathname + url.search + url.hash : fallback;
  } catch {
    return fallback;
  }
}
