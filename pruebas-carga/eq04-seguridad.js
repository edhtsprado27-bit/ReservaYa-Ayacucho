// EQ-04 · Seguridad: las operaciones protegidas se rechazan sin permiso.
//
// Intenta, primero SIN sesión y luego con una cuenta de JUGADOR:
//  - registrar, corregir o quitar canchas (solo dueño/admin),
//  - aprobar un local publicado (solo admin),
//  - cambiar el Yape/Plin de un local ajeno,
//  - confirmar un pago o cancelar / pagar una reserva que no es suya.
//
// Medida: el 100 % de los intentos se rechaza (401, 403 o 404 con ok:false),
// ninguna respuesta trae datos sensibles y el catálogo publicado no cambia.
//
// Ejemplo:
//   (con $env:SUPABASE_URL, $env:SUPABASE_CLAVE y $env:K6_CLAVE ya definidas en PowerShell)
//   k6 run eq04-seguridad.js

import http from "k6/http";
import { check } from "k6";
import { Counter } from "k6/metrics";
import { BASE, cuentasDePrueba, localesPublicados, uuid } from "./comun.js";

export const options = {
  scenarios: { intentos: { executor: "shared-iterations", vus: 1, iterations: 1 } },
  thresholds: {
    intentos_aceptados: ["count==0"], // ningún intento indebido funciona
    datos_expuestos: ["count==0"], // ninguna respuesta trae datos sensibles
    checks: ["rate==1"],
  },
};

const aceptados = new Counter("intentos_aceptados");
const expuestos = new Counter("datos_expuestos");

// Palabras que nunca deberían aparecer en una respuesta de error
const SENSIBLE = /access_token|refresh_token|signedURL|comprobantes\/|service_role|"yape"\s*:\s*"9|password/i;

// PNG mínimo (1x1) para el intento de pago
const PNG = http.file(
  new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0, 31, 21, 196, 137]).buffer,
  "captura.png",
  "image/png",
);

export function setup() {
  const locales = localesPublicados();
  const cookieJugador = cuentasDePrueba(1)[0];
  return { local: locales[0], totalAntes: locales.length, cookieJugador };
}

function casos(local) {
  const reservaAjena = uuid();
  const pagoAjeno = uuid();
  const nueva = { nombre: "Prueba seguridad k6", distrito: "Ayacucho", lat: -13.16, lng: -74.22, deportes: ["Fútbol"] };
  return [
    ["Registrar una cancha", "POST", "/api/canchas", nueva],
    ["Corregir una cancha publicada", "PUT", `/api/canchas/${local}`, nueva],
    ["Quitar una cancha publicada", "DELETE", `/api/canchas/${local}`, null],
    ["Aprobar o rechazar un local (admin)", "POST", `/api/admin/locales/${local}`, { accion: "rechazar", motivo: "prueba k6" }],
    ["Cambiar el Yape de un local ajeno", "PUT", `/api/locales/${local}/pago`, { yape: "999999999", titular: "Atacante" }],
    ["Confirmar un pago ajeno", "POST", `/api/pagos/${pagoAjeno}/revisar`, { accion: "confirmar" }],
    ["Cancelar una reserva ajena", "POST", `/api/reservas/${reservaAjena}/cancelar`, { motivo: "prueba k6" }],
    ["Pagar una reserva ajena", "POST", `/api/reservas/${reservaAjena}/pago`, "MULTIPART"],
  ];
}

function intentar(quien, cookie, [nombre, metodo, ruta, cuerpo]) {
  const headers = cookie ? { Cookie: cookie } : {};
  let datos = null;
  if (cuerpo === "MULTIPART") datos = { metodo: "yape", imagen: PNG };
  else if (cuerpo) {
    datos = JSON.stringify(cuerpo);
    headers["Content-Type"] = "application/json";
  }
  const r = http.request(metodo, `${BASE}${ruta}`, datos, {
    headers,
    tags: { name: "seguridad" },
    responseType: "text",
    responseCallback: http.expectedStatuses(401, 403, 404), // el rechazo es lo esperado
  });
  let j = {};
  try {
    j = r.json() || {};
  } catch {
    j = {};
  }
  const rechazado = [401, 403, 404].includes(r.status) && j.ok !== true;
  const fuga = SENSIBLE.test(String(r.body));
  if (!rechazado) aceptados.add(1);
  if (fuga) expuestos.add(1);
  check(r, {
    [`${quien} · ${nombre}: rechazado`]: () => rechazado,
    [`${quien} · ${nombre}: sin datos sensibles`]: () => !fuga,
  });
  console.log(`${quien.padEnd(11)} | ${nombre.padEnd(36)} | ${metodo.padEnd(6)} ${ruta.replace(/[0-9a-f-]{36}/g, "{id}").padEnd(30)} | ${r.status} ${j.codigo || ""}`);
}

export default function (d) {
  for (const c of casos(d.local)) intentar("Sin sesión", null, c);
  for (const c of casos(d.local)) intentar("Jugador", d.cookieJugador, c);

  // Sin sesión, "mis reservas" y "mis canchas" vienen vacías (no muestran datos de nadie)
  const mias = http.get(`${BASE}/api/reservas`, { tags: { name: "seguridad" }, responseType: "text" });
  check(mias, { "Sin sesión · Mis reservas: lista vacía": (r) => r.status === 200 && (r.json("reservas") || []).length === 0 });
}

export function teardown(d) {
  // El catálogo publicado sigue igual: nadie pudo aprobar, rechazar ni borrar
  const despues = localesPublicados();
  const sigue = despues.includes(d.local);
  console.log(`Catálogo: ${d.totalAntes} canchas antes, ${despues.length} después; el local atacado ${sigue ? "sigue publicado" : "YA NO ESTÁ"}`);
  if (!sigue) aceptados.add(1);
}
