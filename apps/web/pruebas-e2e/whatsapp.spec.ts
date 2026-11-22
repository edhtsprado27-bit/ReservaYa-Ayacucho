// WhatsApp de ayuda (RF15): el admin escribe el número en /admin y aparece el
// botón "Ayuda" en toda la web. Son enlaces wa.me: sin API de WhatsApp ni costo.
import { expect, test } from "@playwright/test";
import { abrirComo, principal, sesionDe } from "./apoyo";

test.use({ storageState: sesionDe("admin") });

test("el admin configura el WhatsApp de ayuda y aparece en toda la web; también puede escribir a un dueño", async ({ page, browser }) => {
  const { contexto, page: visitante } = await abrirComo(browser, null);
  const ayuda = visitante.getByRole("link", { name: "Ayuda por WhatsApp" });
  try {
    await visitante.goto("/");
    await expect(principal(visitante).locator("article.tarjeta").first()).toBeVisible();
    await expect(ayuda).toHaveCount(0); // sin número configurado no hay botón

    await page.goto("/admin");
    const seccion = principal(page).getByRole("region", { name: "WhatsApp de ayuda" });
    const campo = seccion.getByLabel("Celular de ayuda (WhatsApp)");
    const guardar = seccion.getByRole("button", { name: "Guardar" });
    await campo.fill("12345");
    await guardar.click();
    await expect(seccion.getByRole("alert")).toContainText("9 dígitos");
    await campo.fill("966 111 222");
    await guardar.click();
    await expect(seccion.getByRole("status")).toContainText("966 111 222");

    // El admin puede escribir al dueño de un local por WhatsApp
    const losAndes = principal(page).locator("li.local-admin", { hasText: "Complejo Los Andes" });
    await expect(losAndes.getByRole("link", { name: "WhatsApp al dueño" })).toHaveAttribute(
      "href",
      /^https:\/\/wa\.me\/51966123456\?text=Hola%20Rosa%2C%20te%20escribimos%20del%20equipo/,
    );

    // El botón sale en el mapa, en la ficha y en el login, con el mensaje ya escrito
    for (const ruta of ["/", "/cancha/complejo-los-andes", "/login"]) {
      await visitante.goto(ruta);
      await expect(ayuda).toHaveAttribute("href", "https://wa.me/51966111222?text=Hola%2C%20necesito%20ayuda%20con%20ReservaYa%20Ayacucho.");
    }
    await visitante.goto("/");
    await expect(ayuda).toBeVisible();
    await visitante.screenshot({ path: "pruebas-e2e/resultados/evidencia-ayuda-whatsapp.png" });

    // Vacío = se quita el botón
    await campo.fill("");
    await guardar.click();
    await expect(seccion.getByRole("status")).toContainText("se quitó");
    await visitante.reload();
    await expect(principal(visitante).locator("article.tarjeta").first()).toBeVisible();
    await expect(ayuda).toHaveCount(0);
  } finally {
    // Que el botón flotante no quede encima de otras pruebas aunque esta falle
    await page.request.put("/api/admin/ajustes", { data: { whatsappSoporte: "" } });
    await contexto.close();
  }
});
