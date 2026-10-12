import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ConsentInit } from "@/components/ConsentInit";
import { UserMenu } from "@/components/UserMenu";
import { SITE_URL } from "@/lib/site";
import "./globals.css";

const DESCRIPTION =
  "Portal de service desk em Next.js 16: fila de chamados com filtros, prioridade pela matriz ITIL, SLA em horário comercial, comentários internos e indicadores.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "Portal de Chamados", template: "%s · Portal de Chamados" },
  description: DESCRIPTION,
  applicationName: "Portal de Chamados",
  authors: [{ name: "Ademar Chami Neto", url: "https://ademarchamineto.github.io/" }],
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: "Portal de Chamados",
    title: "Portal de Chamados",
    description: "Help desk com SLA em horário comercial, prioridade ITIL e verificação em duas etapas.",
  },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = { themeColor: "#7d1690" };

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Portal de Chamados",
  url: SITE_URL,
  description: DESCRIPTION,
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  inLanguage: "pt-BR",
  isAccessibleForFree: true,
  author: { "@type": "Person", name: "Ademar Chami Neto", url: "https://ademarchamineto.github.io/" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className="h-full antialiased">
      <body className="flex min-h-full flex-col font-sans">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
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
        <footer className="mx-auto w-full max-w-6xl px-4 pb-6 text-sm text-muted">
          <Link href="/privacidade" className="hover:underline">Privacidade</Link>
          <span aria-hidden> · </span>
          <a href="https://github.com/AdemarChamiNeto/portal-chamados" className="hover:underline">Código-fonte</a>
        </footer>
        <ConsentInit />
      </body>
    </html>
  );
}
