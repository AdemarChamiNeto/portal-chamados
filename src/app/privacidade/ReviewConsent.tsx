"use client";

import { useState } from "react";
import { resetConsent } from "@/lib/consent";

export function ReviewConsent() {
  const [done, setDone] = useState(false);
  return (
    <p className="flex flex-wrap items-center gap-3">
      <button type="button" className="btn" onClick={() => { resetConsent(); setDone(true); }}>
        Rever minha escolha de cookies
      </button>
      {done && <span role="status" className="text-sm text-muted">Pronto: o aviso aparece de novo na próxima página.</span>}
    </p>
  );
}
