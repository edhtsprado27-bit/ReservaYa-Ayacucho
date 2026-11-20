// Panel del dueño: agenda (reserva por teléfono, cobro, cancelación, bloqueo)
// y configuración del local; lo que cambia el dueño lo ve el jugador al instante.
import { expect, test, type Page } from "@playwright/test";
import { abrirComo, abrirGrilla, mananaLima, principal, sesionDe, turno } from "./apoyo";

test.use({ storageState: sesionDe("dueno") });

const fila = (page: Page, hora: string) =>
  principal(page).locator(".fila-agenda", { has: page.locator(".fila-hora", { hasText: new RegExp(`^${hora}`) }) });

async function abrirAgendaDeManana(page: Page, cancha: string) {
  await page.goto("/dueno");
  await principal(page).getByRole("link", { name: "Agenda de reservas" }).click();
  await expect(principal(page).getByRole("heading", { name: "Agenda de reservas" })).toBeVisible();
  await principal(page).getByRole("button", { name: "Siguiente →" }).click();
  await expect(page).toHaveURL(new RegExp(`fecha=${mananaLima()}`));
  await principal(page).getByRole("group", { name: "Cancha" }).getByRole("button", { name: new RegExp(`^${cancha}`) }).click();
}

test("agenda: anota una reserva por teléfono, cobra el saldo y la cancela por lluvia", async ({ page, browser }) => {
  const manana = mananaLima();
  await abrirAgendaDeManana(page, "Cancha 2");

  await test.step("anota a quien llamó por teléfono (pagó S/ 20 en efectivo)", async () => {
    await fila(page, "10:00").getByRole("button", { name: "+ Reservar" }).click();
    const form = principal(page).locator(".form-agenda");
    await form.getByLabel("Nombre de quien reserva").fill("Carlos Huamán");
    await form.getByLabel("Celular (opcional)").fill("955 444 333");
    await form.getByLabel("Ya pagó en efectivo (S/)").fill("20");
    await form.getByRole("button", { name: "Guardar reserva" }).click();
    await expect(principal(page).getByRole("status")).toContainText("Reserva de Carlos Huamán guardada");
    await expect(fila(page, "10:00")).toContainText("Confirmada");
    await expect(fila(page, "10:00")).toContainText("Falta S/ 20");
  });

  await test.step("un jugador ya no puede reservar esa hora", async () => {
    const { contexto, page: visitante } = await abrirComo(browser, null);
    await abrirGrilla(visitante, "complejo-los-andes", manana, "Cancha 2");
    await expect(turno(visitante, "10:00")).toHaveAccessibleName(/Ocupada/);
    await contexto.close();
  });

  await test.step("cobra el saldo", async () => {
    await fila(page, "10:00").getByRole("button", { name: "Cobrar" }).click();
    await expect(principal(page).getByLabel("Monto cobrado en efectivo (S/)")).toHaveValue("20");
    await principal(page).getByRole("button", { name: "Registrar cobro" }).click();
    await expect(fila(page, "10:00")).toContainText("Pagado S/ 40");
    await expect(fila(page, "10:00")).not.toContainText("Falta");
  });

  await test.step("la cancela por lluvia y la hora vuelve a quedar libre", async () => {
    await fila(page, "10:00").getByRole("button", { name: "Cancelar" }).click();
    const cancelar = principal(page).getByRole("button", { name: "Cancelar reserva" });
    await expect(cancelar).toBeDisabled(); // sin motivo no se puede
    await principal(page).getByRole("button", { name: "Lluvia" }).click();
    await cancelar.click();
    await expect(fila(page, "10:00")).toContainText("Libre");
  });
});

test("agenda: cierra horas por mantenimiento y el jugador las ve cerradas", async ({ page, browser }) => {
  const manana = mananaLima();
  await abrirAgendaDeManana(page, "Cancha 1");

  await fila(page, "07:00").getByRole("button", { name: "Bloquear" }).click();
  await principal(page).getByLabel("Cerrar hasta").selectOption({ label: "09:00" });
  await principal(page).getByRole("button", { name: "Mantenimiento" }).click();
  await principal(page).locator(".form-agenda").getByRole("button", { name: "Bloquear" }).click();
  await expect(fila(page, "07:00")).toContainText("Cerrada · Mantenimiento");

  const { contexto, page: visitante } = await abrirComo(browser, null);
  await abrirGrilla(visitante, "complejo-los-andes", manana, "Cancha 1");
  await expect(turno(visitante, "07:00")).toHaveAccessibleName(/Cerrada/);
  await expect(turno(visitante, "08:00")).toHaveAccessibleName(/Cerrada/);
  await expect(turno(visitante, "09:00")).toHaveAccessibleName(/S\/ 60/);

  await fila(page, "07:00").getByRole("button", { name: "Abrir de nuevo" }).click();
  await expect(fila(page, "07:00")).toContainText("Libre");
  await contexto.close();

  // Otro visitante ya la ve libre. (Quien ya tenía la grilla abierta puede ver la
  // copia anterior hasta 15 s: la grilla usa caché "stale-while-revalidate" a
  // propósito para aguantar mucho tráfico; la base de datos igual decide al reservar.)
  const otro = await abrirComo(browser, null);
  await abrirGrilla(otro.page, "complejo-los-andes", manana, "Cancha 1");
  await expect(turno(otro.page, "07:00")).toHaveAccessibleName(/S\/ 60/);
  await otro.contexto.close();
});

test("configuración: cambia el precio y el horario de una cancha y el jugador lo ve al instante", async ({ page, browser }) => {
  const manana = mananaLima();
  await page.goto("/dueno");
  await principal(page).getByRole("link", { name: "Configurar mi local" }).click();
  await expect(principal(page).getByRole("heading", { name: "Configurar mi local" })).toBeVisible();

  const cancha2 = principal(page).locator("details.config-cancha", { hasText: "Cancha 2 · Vóley" });
  await cancha2.locator("summary").click();
  await cancha2.getByLabel("Precio por hora (S/)").fill("45");
  for (const dia of ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"]) {
    await cancha2.getByLabel(`${dia}: abre`).selectOption("08:00");
    await cancha2.getByLabel(`${dia}: cierra`).selectOption("22:00");
  }
  await cancha2.getByRole("button", { name: "Guardar cancha" }).click();
  await expect(cancha2.getByRole("status")).toContainText("Cancha guardada");
  await expect(cancha2.locator("summary")).toContainText("S/ 45 la hora · Todos los días 08:00–22:00");

  const { contexto, page: visitante } = await abrirComo(browser, null);
  await abrirGrilla(visitante, "complejo-los-andes", manana, "Cancha 2");
  await expect(turno(visitante, "08:00")).toHaveAccessibleName(/S\/ 45/);
  await expect(turno(visitante, "06:00")).toHaveCount(0); // ya no abre a las 06:00
  await expect(turno(visitante, "21:00")).toBeVisible();
  await expect(turno(visitante, "22:00")).toHaveCount(0);
  await contexto.close();
});
