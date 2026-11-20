// Ayudas compartidas por las pruebas E2E.
import { expect, type Browser, type Page } from "@playwright/test";
import { join } from "node:path";

export const CLAVE = "Prueba-E2E-2026"; // solo existe en la base de pruebas
export const CUENTAS = {
  admin: "admin@e2e.pe",
  dueno: "dueno@e2e.pe",
  dueno2: "dueno2@e2e.pe",
  jugador2: "jugador2@e2e.pe",
  jugador3: "jugador3@e2e.pe",
} as const;
export type Rol = keyof typeof CUENTAS;

/** Archivo con la sesión guardada de cada cuenta (lo crea sesiones.setup.ts) */
export const sesionDe = (rol: Rol) => join(__dirname, ".sesiones", `${rol}.json`);

/** Captura de Yape de ejemplo para subir como comprobante */
export const CAPTURA_YAPE = join(__dirname, "archivos", "captura-yape.png");

/** Fecha de mañana en Ayacucho (AAAA-MM-DD): siempre tiene todas sus horas libres por delante */
export function mananaLima(): string {
  const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" }).format(new Date());
  const d = new Date(`${hoy}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** Inicia sesión con el formulario real de /login */
export async function iniciarSesion(page: Page, email: string, siguiente = "/mi-cuenta") {
  await page.goto(`/login?next=${encodeURIComponent(siguiente)}`);
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(CLAVE);
  await page.getByRole("button", { name: "INICIAR SESIÓN" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
}

/** Nueva pestaña con la sesión de una cuenta (o sin sesión: visitante) */
export async function abrirComo(browser: Browser, rol: Rol | null) {
  const contexto = await browser.newContext({
    storageState: rol ? sesionDe(rol) : undefined,
    locale: "es-PE",
    timezoneId: "America/Lima",
    viewport: { width: 1280, height: 900 },
  });
  return { contexto, page: await contexto.newPage() };
}

/** Página principal visible (con navegación del lado del cliente quedan páginas anteriores ocultas) */
export const principal = (page: Page) => page.locator("main:visible");

/** Botón de una hora en la grilla de reservas: "19:00 a 20:00, S/ 80" */
export const turno = (page: Page, hora: string) =>
  principal(page).getByRole("button", { name: new RegExp(`^${hora} a \\d\\d:\\d\\d,`) });

/** Abre la grilla de un local en una fecha y elige la cancha */
export async function abrirGrilla(page: Page, slug: string, fecha: string, cancha?: string) {
  await page.goto(`/cancha/${slug}?fecha=${fecha}`);
  if (cancha) await principal(page).getByRole("group", { name: "Cancha" }).getByRole("button", { name: new RegExp(`^${cancha}`) }).click();
  await expect(principal(page).locator(".grilla .turno").first()).toBeVisible();
}
