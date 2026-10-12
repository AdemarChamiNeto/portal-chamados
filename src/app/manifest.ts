import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Portal de Chamados",
    short_name: "Chamados",
    description: "Portal de service desk: fila de chamados, SLA em horário comercial e indicadores.",
    lang: "pt-BR",
    start_url: "/chamados",
    display: "standalone",
    background_color: "#faf6f3",
    theme_color: "#7d1690",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
