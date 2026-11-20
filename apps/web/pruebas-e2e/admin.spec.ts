// Panel del administrador: aprobar una cancha nueva, pasar un local a su dueño
// real y suspenderlo/reactivarlo. Cada cambio se ve en el mapa al instante.
import { expect, test, type Page } from "@playwright/test";
import { abrirComo, principal, sesionDe } from "./apoyo";

test.use({ storageState: sesionDe("admin") });
test.describe.configure({ mode: "serial" });

const local = (page: Page, nombre: string) => principal(page).locator("li.local-admin", { hasText: nombre });

async function enElMapa(page: Page, nombre: string) {
  await page.goto("/");
  await page.getByLabel("Buscar canchas").fill(nombre);
  return page.locator("article.tarjeta", { hasText: nombre });
}

test("aprueba una cancha en revisión y aparece en el mapa", async ({ page, browser }) => {
  await page.goto("/admin");
  const tarjeta = principal(page).locator(".tarjeta-revision", { hasText: "Grass Pendiente" });
  await expect(tarjeta).toBeVisible();
  await tarjeta.getByRole("button", { name: "Aprobar" }).click();
  await expect(principal(page).locator(".tarjeta-revision", { hasText: "Grass Pendiente" })).toHaveCount(0);

  const { contexto, page: visitante } = await abrirComo(browser, null);
  await expect(await enElMapa(visitante, "Grass Pendiente")).toBeVisible();
  await contexto.close();
});

test("asigna un local de la plataforma a su dueño real por su correo", async ({ page, browser }) => {
  await page.goto("/admin");
  const canchita = local(page, "La Canchita del Barrio");
  await expect(canchita).toContainText("sin asignar");
  await canchita.getByRole("button", { name: "Asignar dueño" }).click();

  await canchita.getByLabel("Correo de la cuenta del dueño").fill("nadie@e2e.pe");
  await canchita.getByRole("button", { name: "Asignar" }).click();
  await expect(canchita.getByRole("alert")).toContainText("No hay una cuenta con ese correo");

  await canchita.getByLabel("Correo de la cuenta del dueño").fill("dueno2@e2e.pe");
  await canchita.getByRole("button", { name: "Asignar" }).click();
  await expect(canchita.getByRole("status")).toContainText("ahora es de Mario Cárdenas");
  await expect(canchita).toContainText("dueno2@e2e.pe");

  // El nuevo dueño ya puede configurar su local
  const { contexto, page: mario } = await abrirComo(browser, "dueno2");
  await mario.goto("/dueno/configuracion");
  await expect(principal(mario).locator(".agenda-local-nombre")).toHaveText("La Canchita del Barrio");
  await contexto.close();
});

test("suspende un local (sale del mapa) y lo reactiva", async ({ page, browser }) => {
  await page.goto("/admin");
  const canchita = local(page, "La Canchita del Barrio");
  await canchita.getByRole("button", { name: "Suspender" }).click();
  const suspender = canchita.getByRole("button", { name: "Suspender local" });
  await expect(suspender).toBeDisabled(); // sin motivo no se puede
  await canchita.getByRole("button", { name: "Reclamos de jugadores" }).click();
  await suspender.click();
  await expect(canchita.locator(".estado")).toHaveText("Suspendido");

  const { contexto, page: visitante } = await abrirComo(browser, null);
  await expect(await enElMapa(visitante, "La Canchita del Barrio")).toHaveCount(0);
  await visitante.goto("/cancha/la-canchita-del-barrio");
  await expect(principal(visitante).getByText("No encontramos esta cancha")).toBeVisible();

  // El dueño ve el motivo en su panel
  const { contexto: c2, page: mario } = await abrirComo(browser, "dueno2");
  await mario.goto("/dueno/configuracion");
  await expect(principal(mario).getByText("Reclamos de jugadores")).toBeVisible();
  await c2.close();

  await canchita.getByRole("button", { name: "Reactivar" }).click();
  await expect(canchita.locator(".estado")).toHaveText("Publicado");
  await expect(await enElMapa(visitante, "La Canchita del Barrio")).toBeVisible();
  await contexto.close();
});

test("un jugador no puede entrar a los paneles del dueño ni del administrador", async ({ browser }) => {
  const { contexto, page: ana } = await abrirComo(browser, "jugador2");
  await ana.goto("/admin");
  await expect(ana).toHaveURL(/\/mi-cuenta/);
  await ana.goto("/dueno/agenda");
  await expect(ana).toHaveURL(/\/mi-cuenta/);
  const respuesta = await ana.request.get("/api/admin/locales");
  expect(respuesta.status()).toBe(403);
  await contexto.close();

  const { contexto: c2, page: visitante } = await abrirComo(browser, null);
  await visitante.goto("/dueno/configuracion");
  await expect(visitante).toHaveURL(/\/login\?next=%2Fdueno%2Fconfiguracion/);
  await c2.close();
});
