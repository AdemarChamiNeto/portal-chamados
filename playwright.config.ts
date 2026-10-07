import { defineConfig, devices } from "@playwright/test";

// Testes de ponta a ponta contra o build de produção em modo demonstração (sem API externa).
const PORT = 3210;

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false, // os testes compartilham o mesmo "banco" em memória do servidor
  workers: 1,
  retries: process.env.CI ? 1 : 0,
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
    env: { CHAMADOS_API_URL: "" },
  },
});
