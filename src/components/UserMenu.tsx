import Link from "next/link";
import { logout } from "@/app/actions";
import { ROLE_LABEL } from "@/lib/labels";
import { isDemo } from "@/lib/server/backend";
import { getSession } from "@/lib/server/session";
import { isStaff } from "@/lib/types";

export async function UserMenu() {
  const session = await getSession();
  if (!session) return null;
  const { user } = session;
  return (
    <nav aria-label="Menu do usuário" className="flex flex-wrap items-center gap-3 text-sm">
      {isDemo() && <span className="rounded-full border border-warn px-2 py-0.5 text-xs text-warn">modo demonstração</span>}
      <Link href="/chamados" className="hover:underline">Chamados</Link>
      {isStaff(user.role) && <Link href="/indicadores" className="hover:underline">Indicadores</Link>}
      <span className="text-muted">
        {user.name} · {ROLE_LABEL[user.role]}
      </span>
      <form action={logout}>
        <button type="submit" className="btn">Sair</button>
      </form>
    </nav>
  );
}
