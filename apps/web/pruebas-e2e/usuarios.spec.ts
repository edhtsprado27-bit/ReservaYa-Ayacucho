// Gestión de usuarios del administrador (RF08): buscar, cambiar entre jugador y
// dueño, suspender con motivo (la persona lo ve y no puede reservar) y reactivar.
import { expect, test, type Page } from "@playwright/test";
import { abrirComo, CUENTAS, iniciarSesion, mananaLima, principal, sesionDe } from "./apoyo";

test.use({ storageState: sesionDe("admin") });
test.describe.configure({ mode: "serial" });

// Cancha 2 (vóley) de Complejo Los Andes en los datos de prueba
const CANCHA_2 = "e2e00000-0000-4000-8000-0000000000c2";

const cuenta = (page: Page, nombre: string) => principal(page).locator("li.usuario-admin", { hasText: nombre });

async function buscar(page: Page, texto: string) {
  await principal(page).getByRole("searchbox", { name: "Buscar cuentas" }).fill(texto);
  await principal(page).getByRole("button", { name: "Buscar", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`buscar=${texto}`));
}

test("busca una cuenta, la pasa a dueño y la devuelve a jugador; los admins no se tocan", async ({ page }) => {
  await page.goto("/admin");
  await principal(page).getByRole("link", { name: /Usuarios/ }).click();
  await expect(principal(page).getByRole("heading", { name: "Usuarios", exact: true })).toBeVisible();

  await buscar(page, "pedro");
  const pedro = cuenta(page, "Pedro Rojas");
  await expect(principal(page).locator("li.usuario-admin")).toHaveCount(1);
  await expect(pedro).toContainText("jugador3@e2e.pe");
  await pedro.getByRole("button", { name: "Hacer dueño" }).click();
  await expect(pedro.getByRole("status")).toContainText("ahora es dueño de cancha");
  await expect(pedro.locator(".etiqueta-rol")).toHaveText("Dueño de cancha");
  await pedro.getByRole("button", { name: "Pasar a jugador" }).click();
  await expect(pedro.getByRole("status")).toContainText("ahora es jugador");
  await expect(pedro.locator(".etiqueta-rol")).toHaveText("Jugador");

  // Un dueño con locales no pasa a jugador (primero hay que reasignar sus locales).
  // El filtro respeta lo escrito en el buscador: se borra para ver a todos los dueños.
  await principal(page).getByRole("searchbox", { name: "Buscar cuentas" }).fill("");
  await principal(page).getByRole("group", { name: "Tipo de cuenta" }).getByRole("button", { name: "Dueños" }).click();
  await expect(page).toHaveURL(/filtro=duenos/);
  const rosa = cuenta(page, "Rosa Quispe");
  await expect(rosa).toContainText("2 locales");
  await expect(rosa.getByRole("button", { name: "Pasar a jugador" })).toHaveCount(0);
  await expect(rosa).toContainText("asigna sus locales a otra cuenta");

  // La cuenta del propio admin no tiene botones
  await principal(page).getByRole("group", { name: "Tipo de cuenta" }).getByRole("button", { name: "Administradores" }).click();
  const yo = cuenta(page, "Admin E2E");
  await expect(yo).toContainText("(tú)");
  await expect(yo.getByRole("button")).toHaveCount(0);
});

test("suspende una cuenta: no puede ingresar ni reservar y ve el motivo; luego se reactiva", async ({ page, browser }) => {
  await page.goto("/admin/usuarios");
  await buscar(page, "pedro");
  const pedro = cuenta(page, "Pedro Rojas");
  await pedro.getByRole("button", { name: "Suspender" }).click();
  const suspender = pedro.getByRole("button", { name: "Suspender cuenta" });
  await expect(suspender).toBeDisabled(); // sin motivo no se puede
  await pedro.getByRole("button", { name: "Reservas falsas repetidas" }).click();
  await suspender.click();
  await expect(pedro.getByRole("status")).toContainText("quedó suspendida");
  await expect(pedro.locator(".estado")).toHaveText("Suspendida");

  // Con su sesión guardada: ve el aviso con el motivo y la API lo rechaza
  const { contexto, page: sesionVieja } = await abrirComo(browser, "jugador3");
  await sesionVieja.goto("/mi-cuenta");
  await expect(sesionVieja).toHaveURL(/\/cuenta-suspendida/);
  await expect(principal(sesionVieja).getByRole("heading", { name: "Tu cuenta está suspendida" })).toBeVisible();
  await expect(principal(sesionVieja)).toContainText("Reservas falsas repetidas");
  await expect(sesionVieja.getByRole("link", { name: "Cuenta suspendida" })).toBeVisible();
  const manana = mananaLima();
  const intento = await sesionVieja.request.post("/api/reservas", {
    data: { canchaId: CANCHA_2, inicio: `${manana}T10:00:00-05:00`, fin: `${manana}T11:00:00-05:00`, clave: "e2e-suspendida-1" },
  });
  expect(intento.status()).toBe(401);
  await sesionVieja.screenshot({ path: "pruebas-e2e/resultados/evidencia-cuenta-suspendida.png", fullPage: true });

  // Al ingresar con el formulario también llega al aviso
  const visitante = await abrirComo(browser, null);
  await iniciarSesion(visitante.page, CUENTAS.jugador3);
  await expect(visitante.page).toHaveURL(/\/cuenta-suspendida/);
  await visitante.contexto.close();

  // El admin la reactiva desde el filtro "Suspendidas"
  await principal(page).getByRole("group", { name: "Tipo de cuenta" }).getByRole("button", { name: "Suspendidas" }).click();
  const suspendida = cuenta(page, "Pedro Rojas");
  await expect(suspendida).toContainText("Suspendida: Reservas falsas repetidas");
  await suspendida.getByRole("button", { name: "Reactivar" }).click();
  // Ya no es "suspendida": sale de este filtro y el aviso queda arriba de la lista
  await expect(principal(page).getByRole("status")).toContainText("Pedro Rojas puede volver a ingresar");
  await expect(suspendida).toHaveCount(0);

  await sesionVieja.goto("/cuenta-suspendida");
  await expect(sesionVieja).toHaveURL(/\/mi-cuenta/);
  await expect(principal(sesionVieja).getByRole("heading", { name: "Mi cuenta" })).toBeVisible();
  await contexto.close();
});

test("un dueño no puede usar la gestión de usuarios", async ({ browser }) => {
  const { contexto, page: rosa } = await abrirComo(browser, "dueno");
  await rosa.goto("/admin/usuarios");
  await expect(rosa).toHaveURL(/\/mi-cuenta/);
  expect((await rosa.request.get("/api/admin/usuarios")).status()).toBe(403);
  expect((await rosa.request.put("/api/admin/ajustes", { data: { whatsappSoporte: "966111222" } })).status()).toBe(403);
  await contexto.close();
});
