// Servicios del local (RF01, RF03) y WhatsApp del local (RF15): el dueño marca
// vestuarios, duchas... en "Configurar mi local"; el jugador los ve en la ficha,
// filtra el mapa por ellos y escribe al local por WhatsApp con un enlace wa.me.
import { expect, test } from "@playwright/test";
import { abrirComo, principal, sesionDe } from "./apoyo";

test.use({ storageState: sesionDe("dueno") });

test("el dueño marca los servicios; el jugador los ve en la ficha, filtra el mapa y escribe por WhatsApp", async ({ page, browser }) => {
  await page.goto("/dueno/configuracion");
  const panel = principal(page).getByRole("region", { name: "Servicios del local" });
  await panel.getByLabel("Vestuarios").check();
  await panel.getByLabel("Duchas").check();
  await panel.getByLabel("Iluminación nocturna").check();
  await panel.getByRole("button", { name: "Guardar servicios" }).click();
  await expect(panel.getByRole("status")).toContainText("Servicios guardados");
  await page.screenshot({ path: "pruebas-e2e/resultados/evidencia-servicios-dueno.png", fullPage: true });

  // Ficha pública: servicios en el orden de la lista y botón de WhatsApp del local
  const { contexto, page: visitante } = await abrirComo(browser, null);
  await visitante.goto("/cancha/complejo-los-andes");
  const servicios = principal(visitante).getByRole("region", { name: "Servicios del local" });
  await expect(servicios.getByRole("listitem")).toHaveText(["Vestuarios", "Duchas", "Iluminación nocturna"]);
  await expect(principal(visitante).getByRole("link", { name: "Escribir por WhatsApp" })).toHaveAttribute(
    "href",
    /^https:\/\/wa\.me\/51966123456\?text=Hola%2C%20vi%20Complejo%20Los%20Andes%20en%20ReservaYa/,
  );
  await visitante.screenshot({ path: "pruebas-e2e/resultados/evidencia-servicios-ficha.png", fullPage: true });

  // Mapa: "Con: Duchas" deja solo los locales que tienen duchas
  await visitante.goto("/");
  const losAndes = visitante.locator("article.tarjeta", { hasText: "Complejo Los Andes" });
  const canchita = visitante.locator("article.tarjeta", { hasText: "La Canchita del Barrio" });
  await expect(losAndes).toContainText("Duchas");
  await expect(canchita).toBeVisible();
  const filtro = visitante.getByRole("group", { name: "Servicios del local" });
  await filtro.getByRole("button", { name: "Duchas" }).click();
  await expect(canchita).toHaveCount(0);
  await expect(losAndes).toBeVisible();
  await filtro.getByRole("button", { name: "Tribuna" }).click(); // ninguno tiene duchas Y tribuna
  await expect(visitante.locator("article.tarjeta")).toHaveCount(0);
  await filtro.getByRole("button", { name: "Quitar filtros" }).click();
  await expect(canchita).toBeVisible();
  await contexto.close();

  // Desmarcar uno también se ve al instante
  await panel.getByLabel("Iluminación nocturna").uncheck();
  await panel.getByRole("button", { name: "Guardar servicios" }).click();
  await expect(panel.getByRole("status")).toContainText("Servicios guardados");
  const otro = await abrirComo(browser, null);
  await otro.page.goto("/cancha/complejo-los-andes");
  await expect(principal(otro.page).getByRole("region", { name: "Servicios del local" }).getByRole("listitem")).toHaveText(["Vestuarios", "Duchas"]);
  await otro.contexto.close();
});
