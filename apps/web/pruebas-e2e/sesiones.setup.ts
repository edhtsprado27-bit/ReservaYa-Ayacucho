// Paso previo: cada cuenta de prueba inicia sesión con el formulario real de
// /login y se guarda su sesión (cookies). Las demás pruebas la reutilizan.
import { expect, test as preparar } from "@playwright/test";
import { CLAVE, CUENTAS, iniciarSesion, sesionDe, type Rol } from "./apoyo";

preparar("una contraseña equivocada muestra un mensaje claro", async ({ page }) => {
  await page.goto("/login");
  await page.locator("#email").fill(CUENTAS.dueno);
  await page.locator("#password").fill(`${CLAVE}-mal`);
  await page.getByRole("button", { name: "INICIAR SESIÓN" }).click();
  await expect(page.getByText(/correo o contraseña/i)).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
});

for (const rol of Object.keys(CUENTAS) as Rol[]) {
  preparar(`iniciar sesión como ${rol}`, async ({ page }) => {
    await iniciarSesion(page, CUENTAS[rol]);
    await expect(page).toHaveURL(/\/mi-cuenta/);
    await page.context().storageState({ path: sesionDe(rol) });
  });
}
