import type { Metadata } from "next";
import Link from "next/link";
import { ReviewConsent } from "./ReviewConsent";

export const metadata: Metadata = {
  title: "Privacidade",
  description: "Quais dados o Portal de Chamados usa, quais cookies grava e como as estatísticas funcionam.",
  alternates: { canonical: "/privacidade" },
};

export default function PrivacidadePage() {
  return (
    <article className="card mx-auto grid max-w-3xl gap-4 p-6 leading-relaxed">
      <h1 className="text-2xl font-bold">Privacidade</h1>
      <p>
        O Portal de Chamados é um projeto de portfólio. A demonstração publicada usa <strong>usuários e chamados fictícios</strong>,
        guardados só na memória do servidor: eles voltam ao estado inicial quando o servidor reinicia.
      </p>

      <h2 className="text-lg font-semibold">Cookies</h2>
      <ul className="list-disc space-y-1 pl-6">
        <li>
          <strong>Sessão (necessário):</strong> um cookie <code>httpOnly</code> com o token de acesso, que o JavaScript da página
          não consegue ler. Ele expira em 8 horas ou quando você sai.
        </li>
        <li>
          <strong>Verificação em duas etapas (necessário, só durante o login):</strong> um cookie de 5 minutos entre a senha e o código.
        </li>
        <li>
          <strong>Estatísticas (opcional):</strong> se aparecer um aviso de cookies, o site está configurado com o Google Analytics 4
          e/ou o Microsoft Clarity. Eles só carregam se você clicar em <em>Aceitar</em>. Nenhum nome, email ou conteúdo de chamado é
          enviado de propósito para eles; se você recusar, nada é carregado.
        </li>
      </ul>
      <ReviewConsent />

      <h2 className="text-lg font-semibold">Ligado à API real</h2>
      <p>
        Quando o portal é ligado à <a className="underline" href="https://github.com/AdemarChamiNeto/api-chamados">API de Chamados</a>,
        os dados (usuários, chamados e comentários) ficam no banco dessa API, e o portal só repassa as chamadas pelo servidor.
      </p>

      <p><Link href="/login" className="underline">← Voltar ao login</Link></p>
    </article>
  );
}
