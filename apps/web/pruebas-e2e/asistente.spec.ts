// Asistente de canchas (RF09, HU08). En las pruebas no hay clave de OpenRouter:
// responde el modo por reglas, que es el que se usa también cuando la IA falla
// o se acaba el cupo. Las horas que muestra salen de la grilla real.
import { expect, test, type Page } from "@playwright/test";
import { abrirComo, mananaLima, principal } from "./apoyo";

/** Pasado mañana en Ayacucho (los otros specs reservan mañana) */
function pasadoManana(): string {
  const d = new Date(`${mananaLima()}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

const chat = (page: Page) => principal(page).getByRole("region", { name: "Chat con el asistente" });
const ultimaRespuesta = (page: Page) => chat(page).locator(".chat-burbuja--asistente:not(.chat-escribiendo)").last();

async function escribir(page: Page, mensaje: string) {
  await expect(chat(page).getByLabel("Escribe tu mensaje")).toBeEditable(); // el chat ya cargó
  const antes = await chat(page).locator(".chat-burbuja--asistente").count();
  await chat(page).getByLabel("Escribe tu mensaje").fill(mensaje);
  await chat(page).getByRole("button", { name: "Enviar" }).click();
  await expect(chat(page).locator(".chat-burbuja--asistente:not(.chat-escribiendo)")).toHaveCount(antes + 1);
}

test("el visitante pide una cancha, ajusta la hora y va directo a la grilla con esa hora elegida", async ({ browser }) => {
  const { contexto, page } = await abrirComo(browser, null);
  const fecha = pasadoManana();

  // Se llega desde la cabecera
  await page.goto("/");
  await page.getByRole("navigation", { name: "Principal" }).getByRole("link", { name: "Asistente" }).click();
  await expect(page).toHaveURL(/\/asistente$/);
  await expect(principal(page).getByRole("heading", { level: 1 })).toHaveText("Asistente de canchas");
  await expect(ultimaRespuesta(page)).toContainText("Dime qué quieres jugar, dónde y cuándo");
  await expect(chat(page)).toContainText("Si inicias sesión, la IA entiende preguntas más libres");

  // Búsqueda: local, deporte, día y hora (un partido "a las 7" es de noche)
  await escribir(page, "fútbol en Los Andes pasado mañana a las 7");
  const r1 = ultimaRespuesta(page);
  await expect(r1).toContainText(/encontré 1 local con canchas de fútbol en «Complejo Los Andes» y esa hora libre/);
  await expect(r1.locator(".chat-entendido .chip-mini")).toContainText(["Complejo Los Andes", "Fútbol", "19:00"]);
  await expect(r1.getByRole("link", { name: "Reservar Complejo Los Andes a las 19:00, Cancha 1" })).toContainText("S/ 80");
  await expect(r1.locator(".chat-ia")).toHaveCount(0); // lo entendieron las reglas, sin IA
  await page.screenshot({ path: "pruebas-e2e/resultados/evidencia-asistente.png", fullPage: true });

  // Seguimiento: solo cambia la hora
  await escribir(page, "¿y a las 8?");
  const r2 = ultimaRespuesta(page);
  await expect(r2.locator(".chat-entendido .chip-mini")).toContainText(["Complejo Los Andes", "Fútbol", "20:00"]);
  await r2.getByRole("link", { name: "Reservar Complejo Los Andes a las 20:00, Cancha 1" }).click();

  // La ficha abre ese día, esa cancha y esa hora ya elegida
  await expect(page).toHaveURL(new RegExp(`/cancha/complejo-los-andes\\?fecha=${fecha}&cancha=[^&]+&desde=20:00&hasta=21:00$`));
  const resumen = principal(page).locator(".resumen-reserva");
  await expect(resumen).toContainText("20:00 – 21:00");
  await expect(resumen).toContainText("Total S/ 80");
  await expect(resumen.getByRole("link", { name: "Ingresa para reservar" })).toBeVisible();

  // Al volver, la conversación sigue ahí
  await page.goBack();
  await expect(chat(page).locator(".chat-burbuja--persona")).toHaveText(["fútbol en Los Andes pasado mañana a las 7", "¿y a las 8?"]);
  await contexto.close();
});

test("responde dudas frecuentes y ofrece sugerencias", async ({ browser }) => {
  const { contexto, page } = await abrirComo(browser, "jugador2");
  await page.goto("/asistente");

  await escribir(page, "¿Cómo pago el adelanto?");
  await expect(ultimaRespuesta(page)).toContainText("Yape o Plin");
  const sugerencias = chat(page).getByRole("group", { name: "Sugerencias" });
  await expect(sugerencias.getByRole("button", { name: "Fútbol hoy en la noche" })).toBeVisible();

  // Una sugerencia se envía con un toque
  await sugerencias.getByRole("button", { name: "¿Cómo reservo una cancha?" }).click();
  await expect(ultimaRespuesta(page)).toContainText("pulsa «Reservar»");

  // Lo que no entiende lo dice y explica cómo preguntar
  await escribir(page, "cuéntame un chiste");
  await expect(ultimaRespuesta(page)).toContainText("No te entendí bien");

  // Con sesión, el pie lo dice distinto; "Nueva conversación" empieza de cero
  await expect(chat(page)).toContainText("La IA solo ayuda a entender lo que escribes");
  await chat(page).getByRole("button", { name: "Nueva conversación" }).click();
  await expect(chat(page).locator(".chat-burbuja--persona")).toHaveCount(0);
  await contexto.close();
});
