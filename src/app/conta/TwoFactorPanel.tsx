"use client";

import { useActionState, useState, useTransition } from "react";
import { disableTwoFactor, enableTwoFactor, setupTwoFactor, type TwoFactorState } from "@/app/actions";
import { SubmitButton } from "@/components/SubmitButton";

/** 2FA opcional: ativar (QR code + primeiro código) e desativar (senha + código). */
export function TwoFactorPanel({ enabled }: { enabled: boolean }) {
  const [setup, setSetup] = useState<TwoFactorState>({});
  const [starting, startSetup] = useTransition();
  const [enableState, enableAction] = useActionState<TwoFactorState, FormData>(enableTwoFactor, {});
  const [disableState, disableAction] = useActionState<TwoFactorState, FormData>(disableTwoFactor, {});
  const [disabling, setDisabling] = useState(false);

  // códigos de recuperação: aparecem uma vez só, logo depois de ativar
  if (enableState.step === "codes" && enableState.recoveryCodes) {
    return (
      <div className="grid gap-3">
        <p role="status" className="font-medium text-ok">Verificação em duas etapas ativada.</p>
        <p className="text-sm">
          Guarde estes <strong>códigos de recuperação</strong> num lugar seguro. Cada um entra uma vez se você perder o celular.
          Eles não serão mostrados de novo.
        </p>
        <ul className="grid grid-cols-2 gap-x-6 gap-y-1 font-mono text-sm" aria-label="Códigos de recuperação">
          {enableState.recoveryCodes.map((c) => <li key={c}>{c}</li>)}
        </ul>
        <div>
          <button type="button" className="btn" onClick={() => navigator.clipboard?.writeText(enableState.recoveryCodes!.join("\n"))}>
            Copiar códigos
          </button>
        </div>
      </div>
    );
  }

  if (enabled && !disableState.ok) {
    return (
      <div className="grid gap-3">
        <p className="font-medium text-ok">Ativa. O login pede o código do app autenticador.</p>
        {!disabling ? (
          <div><button type="button" className="btn" onClick={() => setDisabling(true)}>Desativar</button></div>
        ) : (
          <form action={disableAction} className="grid max-w-xs gap-3">
            <p className="text-sm text-muted">Para desativar, confirme a senha e um código do app (ou de recuperação).</p>
            <div>
              <label htmlFor="2fa-senha" className="label">Senha</label>
              <input id="2fa-senha" name="password" type="password" className="field" required autoComplete="current-password" />
            </div>
            <div>
              <label htmlFor="2fa-codigo" className="label">Código</label>
              <input id="2fa-codigo" name="code" className="field font-mono" required autoComplete="one-time-code" />
            </div>
            {disableState.error && <p role="alert" className="text-sm text-danger">{disableState.error}</p>}
            <div className="flex gap-2">
              <SubmitButton pendingText="Desativando…">Desativar 2FA</SubmitButton>
              <button type="button" className="btn" onClick={() => setDisabling(false)}>Cancelar</button>
            </div>
          </form>
        )}
      </div>
    );
  }

  if (setup.step !== "setup") {
    return (
      <div className="grid gap-3">
        {disableState.ok && <p role="status" className="text-sm text-ok">Verificação em duas etapas desativada.</p>}
        <p className="text-sm text-muted">
          Opcional: além da senha, o login passa a pedir um código do app autenticador (Google Authenticator, Authy, Microsoft Authenticator…).
        </p>
        <div>
          <button type="button" className="btn btn-primary" disabled={starting}
            onClick={() => startSetup(async () => setSetup(await setupTwoFactor()))}>
            {starting ? "Gerando…" : "Ativar verificação em duas etapas"}
          </button>
        </div>
        {setup.error && <p role="alert" className="text-sm text-danger">{setup.error}</p>}
      </div>
    );
  }

  return (
    <form action={enableAction} className="grid gap-3">
      <p className="text-sm">1. Leia o QR code no app autenticador.</p>
      {setup.qr && (
        // eslint-disable-next-line @next/next/no-img-element -- imagem data: gerada no servidor, não há o que otimizar
        <img src={setup.qr} width={200} height={200} alt="QR code para o app autenticador" className="rounded border border-line" />
      )}
      <p className="text-sm text-muted">
        Sem câmera? Digite a chave: <code className="break-all">{setup.secret?.match(/.{1,4}/g)?.join(" ")}</code>
      </p>
      <div className="max-w-xs">
        <label htmlFor="2fa-confirmar" className="label">2. Digite o código de 6 dígitos que aparece no app</label>
        <input id="2fa-confirmar" name="code" className="field font-mono" required inputMode="numeric" pattern="\d{6}" maxLength={6} autoComplete="one-time-code" />
      </div>
      {enableState.error && <p role="alert" className="text-sm text-danger">{enableState.error}</p>}
      <div className="flex gap-2">
        <SubmitButton pendingText="Ativando…">Confirmar e ativar</SubmitButton>
        <button type="button" className="btn" onClick={() => setSetup({})}>Cancelar</button>
      </div>
    </form>
  );
}
