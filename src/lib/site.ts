/** Endereço público do portal (Open Graph, canonical, sitemap). Em outro domínio, defina SITE_URL. */
export const SITE_URL = (process.env.SITE_URL ?? "https://portal-chamados-swart.vercel.app").replace(/\/$/, "");
