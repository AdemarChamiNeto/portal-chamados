"use client";

import { useEffect } from "react";
import { initConsent } from "@/lib/consent";

/** Mostra o aviso de cookies (só se NEXT_PUBLIC_GA_ID ou NEXT_PUBLIC_CLARITY_ID estiver configurado). */
export function ConsentInit() {
  useEffect(() => initConsent("/privacidade"), []);
  return null;
}
