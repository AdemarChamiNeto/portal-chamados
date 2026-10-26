import { defineConfig, devices } from "@playwright/test";

// Testes de integração contra a API de Chamados (PHP) de verdade. A API precisa estar no ar antes:
// no repositório api-chamados, `docker compose up -d` (MySQL + dados de exemplo em http://localhost:8080).
const PORT = 3220;
const API_URL = process.env.E2E_API_URL ?? "http://localhost:8080";

export default defineConfig({
  testDir: "tests/e2e-api",
  fullyParallel: false,
  workers: 1,
  retries: 0, // o banco guarda o que cada teste fez (2FA ativado, chamados abertos): repetir não começa do zero
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    ...devices["Desktop Chrome"],
    launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {},
  },
  webServer: {
    command: `npm run build && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/login`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: { CHAMADOS_API_URL: API_URL },
  },
});
