// EQ-02 · Consistencia: 50 pedidos AL MISMO TIEMPO por el mismo horario.
//
// Medida: se crea exactamente UNA reserva y los otros 49 reciben 409 HORARIO_OCUPADO.
//
// Cómo funciona:
//  1. Preparación: entra con 5 cuentas de jugador de prueba (las crea si no existen)
//     y busca un horario libre dentro de ~25 días (para no molestar a nadie).
//  2. Carrera: 50 usuarios virtuales esperan la misma hora exacta y envían
//     POST /api/reservas por ese horario, cada uno con su propia clave.
//     Con 5 cuentas, 10 pedidos por cuenta: compiten personas distintas.
//  3. Cierre: revisa que la grilla muestre el horario "ocupado" y cancela la
//     reserva ganadora, para dejar todo como estaba.
//
// Ejemplo:
//   (con $env:SUPABASE_URL, $env:SUPABASE_CLAVE y $env:K6_CLAVE ya definidas en PowerShell)
//   k6 run eq02-concurrencia.js

import http from "k6/http";
import { check, sleep } from "k6";
import { Counter } from "k6/metrics";
import { BASE, cuentasDePrueba, fechaLima, localesPublicados, uuid } from "./comun.js";

const PEDIDOS = Number(__ENV.PEDIDOS || 50);
const CUENTAS = Number(__ENV.CUENTAS || 5);

export const options = {
  setupTimeout: "2m",
  teardownTimeout: "1m",
  scenarios: {
    carrera: { executor: "per-vu-iterations", vus: PEDIDOS, iterations: 1, maxDuration: "1m" },
  },
  thresholds: {
    reservas_creadas: ["count==1"], // exactamente una gana
    rechazos_horario_ocupado: [`count==${PEDIDOS - 1}`], // las demás: 409
    otras_respuestas: ["count==0"], // ningún error inesperado
  },
};

const creadas = new Counter("reservas_creadas");
const ocupadas = new Counter("rechazos_horario_ocupado");
const otras = new Counter("otras_respuestas");

/** Busca un horario libre de al menos 60 minutos seguidos en la misma cancha */
function buscarHorario() {
  const locales = localesPublicados();
  for (const dias of [25, 26, 27, 28, 24, 23]) {
    for (const local of locales) {
      const r = http.get(`${BASE}/api/disponibilidad?local=${local}&fecha=${fechaLima(dias)}&sincdn=${Date.now()}`, {
        tags: { name: "preparacion" },
        responseType: "text",
      });
      if (r.status !== 200) continue;
      const turnos = r.json("turnos") || [];
      for (let i = 0; i < turnos.length; i++) {
        const t = turnos[i];
        if (t.estado !== "libre" || t.precio == null) continue;
        let fin = t.fin;
        // Suma turnos seguidos de la misma cancha hasta completar 60 minutos
        for (let j = i + 1; Date.parse(fin) - Date.parse(t.inicio) < 3600e3 && j < turnos.length; j++) {
          const s = turnos[j];
          if (s.cancha !== t.cancha || s.inicio !== fin || s.estado !== "libre" || s.precio == null) break;
          fin = s.fin;
        }
        if (Date.parse(fin) - Date.parse(t.inicio) >= 3600e3) return { local, canchaId: t.cancha, inicio: t.inicio, fin };
      }
    }
  }
  throw new Error("No se encontró un horario libre con precio en los próximos días.");
}

export function setup() {
  const cookies = cuentasDePrueba(CUENTAS);
  const horario = buscarHorario();
  console.log(`Horario de la carrera: cancha ${horario.canchaId}, ${horario.inicio} -> ${horario.fin}`);
  // Todos salen juntos 5 segundos después de terminar la preparación
  return { cookies, horario, salida: Date.now() + 5000 };
}

export default function (d) {
  const espera = (d.salida - Date.now()) / 1000;
  if (espera > 0) sleep(espera);

  const cookie = d.cookies[(__VU - 1) % d.cookies.length];
  const cuerpo = JSON.stringify({ canchaId: d.horario.canchaId, inicio: d.horario.inicio, fin: d.horario.fin, clave: uuid() });
  const r = http.post(`${BASE}/api/reservas`, cuerpo, {
    headers: { "Content-Type": "application/json", Cookie: cookie },
    tags: { name: "reservar" },
    responseType: "text",
    responseCallback: http.expectedStatuses(201, 409), // 409 es la respuesta correcta para los que pierden
  });

  let codigo = "";
  try {
    codigo = r.json("codigo") || "";
  } catch {
    codigo = "";
  }
  if (r.status === 201) creadas.add(1);
  else if (r.status === 409 && codigo === "HORARIO_OCUPADO") ocupadas.add(1);
  else {
    otras.add(1);
    console.warn(`Respuesta inesperada (usuario ${__VU}): ${r.status} ${String(r.body).slice(0, 200)}`);
  }
  check(r, { "201 o 409 HORARIO_OCUPADO": () => r.status === 201 || (r.status === 409 && codigo === "HORARIO_OCUPADO") });
}

export function teardown(d) {
  // 1. La grilla (sin caché) debe mostrar el horario ocupado
  const g = http.get(`${BASE}/api/disponibilidad?local=${d.horario.local}&fecha=${d.horario.inicio.slice(0, 10)}&sincdn=${Date.now()}`, {
    tags: { name: "verificacion" },
    responseType: "text",
  });
  const turno = (g.json("turnos") || []).find((t) => t.cancha === d.horario.canchaId && t.inicio === d.horario.inicio);
  console.log(`Después de la carrera, la grilla muestra ese horario como: ${turno ? turno.estado : "(no encontrado)"}`);

  // 2. Cuenta las reservas de ese horario en todas las cuentas y las cancela
  let total = 0;
  for (const cookie of d.cookies) {
    const r = http.get(`${BASE}/api/reservas`, { headers: { Cookie: cookie }, tags: { name: "verificacion" }, responseType: "text" });
    const mias = (r.json("reservas") || []).filter(
      (x) => Date.parse(x.inicio) === Date.parse(d.horario.inicio) && (x.estado === "pending_payment" || x.estado === "payment_review"),
    );
    for (const x of mias) {
      total++;
      const c = http.post(`${BASE}/api/reservas/${x.id}/cancelar`, JSON.stringify({ motivo: "Prueba de concurrencia k6" }), {
        headers: { "Content-Type": "application/json", Cookie: cookie },
        tags: { name: "limpieza" },
      });
      console.log(`Reserva ${x.codigo} cancelada para dejar libre el horario: ${c.status === 200 ? "sí" : "NO (" + c.status + ")"}`);
    }
  }
  console.log(`Reservas activas encontradas para ese horario: ${total} (debe ser 1)`);
}
