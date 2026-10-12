import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";
// GA4/Clarity (carregam só depois do aceite): os domínios entram na CSP apenas se algum ID estiver configurado
const analytics = !!(process.env.NEXT_PUBLIC_GA_ID || process.env.NEXT_PUBLIC_CLARITY_ID);
const GA_CLARITY_SCRIPTS = " https://www.googletagmanager.com https://www.clarity.ms https://*.clarity.ms";
const GA_CLARITY_CONNECT = " https://*.google-analytics.com https://*.analytics.google.com https://*.clarity.ms";

/**
 * CSP sem nonce: o portal usa Partial Prerendering, que não funciona com nonce (o shell estático é
 * gerado no build, sem request). Por isso script-src mantém 'unsafe-inline' para os scripts do Next;
 * o resto fica fechado no próprio site. 'unsafe-eval' só em dev (o React usa para mostrar erros).
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}${analytics ? GA_CLARITY_SCRIPTS : ""}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' blob: data:${analytics ? " https://*.google-analytics.com https://*.googletagmanager.com https://*.clarity.ms" : ""}`,
  "font-src 'self'",
  `connect-src 'self'${analytics ? GA_CLARITY_CONNECT : ""}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
