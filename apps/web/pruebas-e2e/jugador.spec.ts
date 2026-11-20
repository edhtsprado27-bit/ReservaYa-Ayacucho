// Recorrido completo del jugador: encuentra la cancha, se registra, reserva,
// paga el adelanto con Yape (sube la captura) y el dueño confirma el pago.
import { expect, test } from "@playwright/test";
import { abrirComo, abrirGrilla, CAPTURA_YAPE, mananaLima, principal, turno } from "./apoyo";

test("un visitante se registra, reserva, paga el adelanto y el dueño lo confirma", async ({ page, browser }) => {
  const manana = mananaLima();
  const correo = `jugador.${Date.now()}@e2e.pe`;
  let codigo = "";

  await test.step("encuentra la cancha en la lista y ve sus horarios", async () => {
    await page.goto("/");
    const buscador = page.getByRole("searchbox", { name: "Buscar canchas" }).or(page.getByLabel("Buscar canchas"));
    await buscador.fill("andes");
    const tarjeta = page.locator("article.tarjeta", { hasText: "Complejo Los Andes" });
    await expect(tarjeta).toBeVisible();
    await expect(page.locator("article.tarjeta", { hasText: "La Canchita del Barrio" })).toHaveCount(0);
    await tarjeta.getByRole("link", { name: "Reservar" }).click();
    await expect(page).toHaveURL(/\/cancha\/complejo-los-andes/);
    await abrirGrilla(page, "complejo-los-andes", manana);
    await expect(turno(page, "19:00")).toHaveAccessibleName(/S\/ 80/); // hora punta
    await expect(turno(page, "10:00")).toHaveAccessibleName(/S\/ 60/);
  });

  await test.step("sin sesión, la web le pide ingresar", async () => {
    await turno(page, "19:00").click();
    await expect(principal(page).getByText("Total S/ 80 · Adelanto S/ 40")).toBeVisible();
    await principal(page).getByRole("link", { name: "Ingresa para reservar" }).click();
    await expect(page).toHaveURL(/\/login\?next=/);
  });

  await test.step("se registra como jugador y vuelve a la cancha", async () => {
    await page.getByRole("button", { name: "Regístrate" }).click();
    await page.locator("#nombre").fill("Jugador de Prueba");
    await page.locator("#telefono").fill("987 111 222");
    await page.locator("#email").fill(correo);
    await page.locator("#password").fill("Clave-Nueva-2026");
    await page.getByRole("radio", { name: /Reservar canchas/ }).check();
    await page.getByRole("button", { name: "CREAR CUENTA" }).click();
    await page.waitForURL(/\/cancha\/complejo-los-andes/);
  });

  await test.step("reserva las 19:00 de mañana", async () => {
    await abrirGrilla(page, "complejo-los-andes", manana);
    await turno(page, "19:00").click();
    await principal(page).getByRole("button", { name: "Reservar", exact: true }).click();
    await page.waitForURL(/\/reservas\/[0-9a-f-]{36}$/);
    await expect(principal(page).locator(".ticket .estado")).toHaveText("Por pagar");
    codigo = (await principal(page).locator(".codigo").first().innerText()).trim();
    expect(codigo).toMatch(/^RY-/);
    await expect(principal(page).getByText("966 123 456").first()).toBeVisible(); // Yape del local
    await expect(principal(page).getByText(/Rosa Quispe Huamán/)).toBeVisible();
  });

  await test.step("sube la captura de Yape", async () => {
    await principal(page).locator('input[type="file"]').setInputFiles(CAPTURA_YAPE);
    await expect(principal(page).getByAltText("Vista previa de tu captura")).toBeVisible();
    await principal(page).getByRole("button", { name: "Enviar comprobante" }).click();
    await expect(principal(page).locator(".ticket .estado")).toHaveText("Pago en revisión", { timeout: 30_000 });
  });

  await test.step("el dueño ve la captura y confirma el pago", async () => {
    const { contexto, page: dueno } = await abrirComo(browser, "dueno");
    await dueno.goto("/dueno");
    const tarjeta = principal(dueno).locator(".tarjeta-pago", { hasText: codigo });
    await expect(tarjeta).toBeVisible();
    await expect(tarjeta.getByText("Jugador de Prueba")).toBeVisible();
    await expect(tarjeta.locator("img").first()).toBeVisible(); // captura con enlace firmado
    await tarjeta.getByRole("button", { name: "Confirmar pago" }).click();
    await expect(principal(dueno).locator(".tarjeta-pago", { hasText: codigo })).toHaveCount(0);
    await contexto.close();
  });

  await test.step("el jugador ve su reserva confirmada en Mi cuenta", async () => {
    await page.goto("/mi-cuenta");
    const fila = principal(page).locator("li, article", { hasText: codigo }).first();
    await expect(fila).toContainText("Confirmada");
  });
});
