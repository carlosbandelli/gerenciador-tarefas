import { defineConfig, devices } from "@playwright/test";

// E2E é OPCIONAL para quem avalia: `npm test` continua só Vitest e nenhum navegador é baixado
// no `npm install`. Para rodar: `npx playwright install chromium` (uma vez) e `npm run test:e2e`.
const PORTA = 3200;
const CI = Boolean(process.env.CI);

export default defineConfig({
  testDir: "e2e",
  // Os dados vivem em memória no processo do servidor (compartilhados entre testes): um worker
  // e sem paralelismo evitam interferência entre specs.
  workers: 1,
  fullyParallel: false,
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  reporter: CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${PORTA}`,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // Build de produção: mais estável e rápido em runtime que `next dev` (sem compilação sob
    // demanda nem overlay), e é o que de fato vai a produção (SSR/hidratação reais).
    command: `npm run build && npm run start -- -p ${PORTA}`,
    url: `http://localhost:${PORTA}/tarefas`,
    reuseExistingServer: !CI,
    // Cobre o `next build` (inclui download de fontes).
    timeout: 300_000,
  },
});
