import { NextResponse, type NextRequest } from "next/server";

/**
 * Checagem otimista: sem cookie de sessão, manda para o login antes de renderizar qualquer coisa.
 * A validação de verdade (token válido, usuário ativo) acontece no servidor, em getSession().
 */
export function proxy(request: NextRequest) {
  if (!request.cookies.has("chamados_session")) {
    const login = new URL("/login", request.nextUrl);
    if (request.nextUrl.pathname !== "/") login.searchParams.set("voltar", request.nextUrl.pathname + request.nextUrl.search);
    return NextResponse.redirect(login);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!login|api|_next/static|_next/image|favicon.ico|.*\\.(?:png|svg|ico)$).*)"],
};
