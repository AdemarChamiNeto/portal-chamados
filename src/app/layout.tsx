import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { UserMenu } from "@/components/UserMenu";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Portal de Chamados", template: "%s · Portal de Chamados" },
  description: "Portal de service desk em Next.js para a API de Chamados (PHP).",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className="h-full antialiased">
      <body className="flex min-h-full flex-col font-sans">
        <a href="#conteudo" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:rounded focus:bg-surface focus:p-2">
          Pular para o conteúdo
        </a>
        <header className="border-b border-line bg-surface">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
            <Link href="/chamados" className="text-lg font-bold">
              Portal de Chamados
            </Link>
            {/* o menu lê o cookie de sessão: fica dentro de Suspense para o resto do layout ser estático */}
            <Suspense fallback={<span className="h-9" />}>
              <UserMenu />
            </Suspense>
          </div>
        </header>
        <main id="conteudo" className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
          {children}
        </main>
      </body>
    </html>
  );
}
