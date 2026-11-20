// En el celular (Pixel 7): buscar una cancha y ver sus horarios sin que la
// página se salga de la pantalla.
import { expect, test } from "@playwright/test";
import { mananaLima, principal, turno } from "./apoyo";

const sinDesborde = async (page: import("@playwright/test").Page) =>
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);

test("en el celular se busca una cancha y se ven sus horarios con precio", async ({ page }) => {
  await page.goto("/");
  await sinDesborde(page);
  await page.getByLabel("Buscar canchas").fill("los andes");
  const tarjeta = page.locator("article.tarjeta", { hasText: "Complejo Los Andes" });
  await expect(tarjeta).toBeVisible();
  await tarjeta.getByRole("link", { name: "Reservar" }).click();

  await page.goto(`/cancha/complejo-los-andes?fecha=${mananaLima()}`);
  await expect(principal(page).getByRole("heading", { name: "Reserva tu hora" })).toBeVisible();
  await expect(turno(page, "06:00")).toBeVisible();
  await turno(page, "18:00").click();
  await expect(principal(page).getByText(/Total S\/ 80/)).toBeVisible();
  await expect(principal(page).getByRole("link", { name: "Ingresa para reservar" })).toBeVisible();
  await sinDesborde(page);
});
