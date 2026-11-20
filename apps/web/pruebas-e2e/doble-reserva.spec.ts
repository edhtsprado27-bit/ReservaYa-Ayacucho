// Escenario de calidad EQ-02 visto desde el navegador: dos jugadores eligen la
// misma hora y pulsan "Reservar" al mismo tiempo. Solo uno se la lleva; el otro
// recibe un aviso claro y la grilla ya le muestra la hora ocupada.
import { expect, test } from "@playwright/test";
import { abrirComo, abrirGrilla, mananaLima, principal, turno } from "./apoyo";

test("dos jugadores reservan la misma hora a la vez: solo uno lo logra", async ({ browser }) => {
  const manana = mananaLima();
  const ana = await abrirComo(browser, "jugador2");
  const pedro = await abrirComo(browser, "jugador3");

  for (const { page } of [ana, pedro]) {
    await abrirGrilla(page, "complejo-los-andes", manana);
    await turno(page, "21:00").click();
    await expect(principal(page).getByRole("button", { name: "Reservar", exact: true })).toBeEnabled();
  }

  // Los dos pulsan "Reservar" en el mismo instante
  await Promise.all([ana, pedro].map(({ page }) => principal(page).getByRole("button", { name: "Reservar", exact: true }).click()));

  const resultado = async (page: (typeof ana)["page"]) => {
    const gano = page.waitForURL(/\/reservas\/[0-9a-f-]{36}$/, { timeout: 20_000 }).then(() => "reservó");
    const perdio = principal(page)
      .getByRole("alert")
      .filter({ hasText: "Alguien acaba de reservar ese horario" })
      .waitFor({ timeout: 20_000 })
      .then(() => "ocupado");
    return Promise.any([gano, perdio]);
  };
  const [deAna, dePedro] = await Promise.all([resultado(ana.page), resultado(pedro.page)]);
  expect([deAna, dePedro].sort()).toEqual(["ocupado", "reservó"]);

  // Quien perdió ve la hora como ocupada sin recargar la página
  const ganador = deAna === "reservó" ? ana.page : pedro.page;
  const perdedor = deAna === "ocupado" ? ana.page : pedro.page;
  await expect(turno(perdedor, "21:00")).toHaveAccessibleName(/Ocupada/);
  await expect(principal(ganador).locator(".ticket .estado")).toHaveText("Por pagar");

  // Evidencia para el informe: lo que vio cada jugador
  await test.info().attach("jugador que reservó", { body: await ganador.screenshot({ fullPage: true }), contentType: "image/png" });
  await test.info().attach("jugador que llegó tarde", { body: await perdedor.screenshot({ fullPage: true }), contentType: "image/png" });

  await ana.contexto.close();
  await pedro.contexto.close();
});
