// Pruebas E2E con Playwright: un navegador real recorre la web como lo haría
// una persona (jugador, dueño y administrador) contra la app compilada.
//
//   npm run e2e:base   crea la base de pruebas (PostgreSQL + todo el SQL del proyecto)
//   npm run build      compila la web apuntando al Supabase de pruebas (ver .github/workflows/ci.yml)
//   npm run e2e        levanta el Supabase de pruebas y la web, y ejecuta las pruebas
//   npm run e2e:informe abre el informe HTML con capturas y videos
import { defineConfig, devices } from "@playwright/test";

const PUERTO_WEB = Number(process.env.E2E_PUERTO_WEB ?? 3100);
const URL_WEB = `http://localhost:${PUERTO_WEB}`;

export default defineConfig({
  testDir: "./pruebas-e2e",
  outputDir: "./pruebas-e2e/resultados",
  // Las pruebas comparten una base de datos: una a la vez y en orden
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  forbidOnly: Boolean(process.env.CI),
  reporter: [
    ["list"],
    ["html", { outputFolder: "pruebas-e2e/informe", open: "never" }],
    ["json", { outputFile: "pruebas-e2e/resumen-e2e.json" }],
    ...(process.env.CI ? [["github"] as ["github"]] : []),
  ],
  use: {
    baseURL: URL_WEB,
    locale: "es-PE",
    timezoneId: "America/Lima",
    screenshot: "on",
    video: "on",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "sesiones", testMatch: /sesiones\.setup\.ts/ },
    {
      name: "escritorio",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 900 } },
      dependencies: ["sesiones"],
      testIgnore: /celular\.spec\.ts/,
    },
    {
      name: "celular",
      use: { ...devices["Pixel 7"] },
      dependencies: ["sesiones"],
      testMatch: /celular\.spec\.ts/,
    },
  ],
  webServer: [
    {
      command: "node pruebas-e2e/supabase-de-pruebas/servidor.mjs",
      url: "http://127.0.0.1:54321/salud",
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
    {
      command: `npm run start -- -p ${PUERTO_WEB}`,
      url: URL_WEB,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
