// EQ-01 · Rendimiento: buscar canchas y ver los horarios libres.
//
// Cada usuario virtual hace lo que una persona: abre el mapa (GET /api/canchas),
// mira unos segundos, abre una cancha y ve la grilla de un día
// (GET /api/disponibilidad) y vuelve a mirar antes de repetir.
//
// Perfiles (-e PERFIL=...):
//   humo        5 usuarios por 30 segundos: prueba rápida antes de las grandes
//   base        100 usuarios por 3 minutos  -> medida de EQ-01 (p95 <= 1,5 s, errores < 1 %)
//   sin-cdn     igual que base, pero cada pedido salta el CDN de Vercel
//               (para comparar: ¿cuánto ayuda la caché?)
//   progresivo  sube de 100 a 2 000 usuarios en ~13 minutos (lo pide el Sprint 2)
//
// Ejemplo:  k6 run -e PERFIL=base eq01-rendimiento.js

import http from "k6/http";
import { check } from "k6";
import { Counter } from "k6/metrics";
import { BASE, fechaLima, localesPublicados, pensar } from "./comun.js";

const PERFIL = __ENV.PERFIL || "base";
const SIN_CDN = PERFIL === "sin-cdn";

const ETAPAS = {
  humo: [
    { duration: "5s", target: 5 },
    { duration: "30s", target: 5 },
  ],
  base: [
    { duration: "30s", target: 100 },
    { duration: "3m", target: 100 },
    { duration: "30s", target: 0 },
  ],
  progresivo: [
    { duration: "1m", target: 100 },
    { duration: "2m", target: 100 },
    { duration: "2m", target: 500 },
    { duration: "2m", target: 1000 },
    { duration: "2m", target: 2000 },
    { duration: "2m", target: 2000 },
    { duration: "1m", target: 0 },
  ],
};

export const options = {
  scenarios: {
    jugadores: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: ETAPAS[PERFIL] || ETAPAS.base,
      gracefulRampDown: "15s",
    },
  },
  thresholds: {
    // Medida de EQ-01
    "http_req_duration{name:catalogo}": ["p(95)<1500"],
    "http_req_duration{name:disponibilidad}": ["p(95)<1500"],
    "http_req_failed{name:catalogo}": ["rate<0.01"],
    "http_req_failed{name:disponibilidad}": ["rate<0.01"],
    checks: ["rate>0.99"],
  },
  discardResponseBodies: true, // ahorra memoria con muchos usuarios
  summaryTrendStats: ["avg", "min", "med", "p(90)", "p(95)", "p(99)", "max"],
};

// ¿La respuesta salió del CDN de Vercel (HIT) o fue hasta el servidor (MISS)?
const cdn = {
  HIT: new Counter("cdn_hit"),
  STALE: new Counter("cdn_stale"),
  MISS: new Counter("cdn_miss"),
  OTRO: new Counter("cdn_otro"),
};
function contarCdn(r) {
  const estado = (r.headers["X-Vercel-Cache"] || "").toUpperCase();
  (cdn[estado] || cdn.OTRO).add(1);
}

export function setup() {
  return { locales: localesPublicados() };
}

export default function (datos) {
  const salto = SIN_CDN ? `?sincdn=${__VU}-${__ITER}-${Date.now()}` : "";

  // 1. Abre el mapa
  const catalogo = http.get(`${BASE}/api/canchas${salto}`, { tags: { name: "catalogo" } });
  contarCdn(catalogo);
  check(catalogo, { "catálogo responde 200": (r) => r.status === 200 });
  pensar(1, 3);

  // 2. Abre una cancha y mira un día de la semana
  const local = datos.locales[Math.floor(Math.random() * datos.locales.length)];
  const fecha = fechaLima(Math.floor(Math.random() * 7));
  const extra = SIN_CDN ? `&sincdn=${__VU}-${__ITER}-${Date.now()}` : "";
  const grilla = http.get(`${BASE}/api/disponibilidad?local=${local}&fecha=${fecha}${extra}`, { tags: { name: "disponibilidad" } });
  contarCdn(grilla);
  check(grilla, { "disponibilidad responde 200": (r) => r.status === 200 });
  pensar(5, 10);
}
