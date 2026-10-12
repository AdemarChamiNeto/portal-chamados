import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/** Só as páginas públicas (login e privacidade) são indexadas; a área logada fica de fora. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/login", "/privacidade", "/llms.txt"],
      disallow: ["/chamados", "/indicadores", "/conta", "/login/codigo"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
