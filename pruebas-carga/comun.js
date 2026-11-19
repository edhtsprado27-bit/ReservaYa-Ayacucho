// Funciones compartidas por los scripts de k6.
// Las direcciones y claves llegan por variables de entorno (-e NOMBRE=valor),
// así ningún secreto queda escrito en el repositorio.

import http from "k6/http";
import encoding from "k6/encoding";
import { sleep } from "k6";

/** Web que se prueba (por defecto, la publicada en Vercel) */
export const BASE = (__ENV.BASE_URL || "https://reservaya-ayacucho.vercel.app").replace(/\/$/, "");

/** Supabase: solo se usa para iniciar sesión (EQ-02 y EQ-04). Es la URL y la clave PÚBLICA de .env.local */
export const SUPABASE_URL = (__ENV.SUPABASE_URL || "").replace(/\/$/, "");
export const SUPABASE_CLAVE = __ENV.SUPABASE_CLAVE || "";

/** Fecha "AAAA-MM-DD" en hora de Ayacucho (UTC-5, sin horario de verano) dentro de `dias` días */
export function fechaLima(dias) {
  return new Date(Date.now() - 5 * 3600e3 + dias * 864e5).toISOString().slice(0, 10);
}

/** Identificador aleatorio con forma de UUID (para la clave de idempotencia) */
export function uuid() {
  const h = "0123456789abcdef";
  let s = "";
  for (let i = 0; i < 32; i++) s += h[Math.floor(Math.random() * 16)];
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-4${s.slice(13, 16)}-a${s.slice(17, 20)}-${s.slice(20)}`;
}

/** Locales publicados (para elegir a cuál pedir la grilla) */
export function localesPublicados() {
  const r = http.get(`${BASE}/api/canchas`, { tags: { name: "preparacion" }, responseType: "text" });
  if (r.status !== 200) throw new Error(`GET /api/canchas respondió ${r.status}: ¿está bien BASE_URL?`);
  const ids = (r.json("canchas") || []).map((c) => c.id);
  if (ids.length === 0) throw new Error("No hay canchas publicadas: aprueba al menos una en /admin.");
  return ids;
}

/** Espera aleatoria entre `min` y `max` segundos (tiempo que una persona mira la pantalla) */
export function pensar(min, max) {
  sleep(min + Math.random() * (max - min));
}

// ---------------------------------------------------------------------
// Sesión de Supabase Auth en forma de cookie, igual que @supabase/ssr:
//   sb-<proyecto>-auth-token = "base64-" + base64url(JSON de la sesión)
//   (si pasa de 3180 caracteres se parte en .0, .1, ...)
// ---------------------------------------------------------------------

function exigirSupabase() {
  if (!SUPABASE_URL || !SUPABASE_CLAVE) {
    throw new Error("Falta -e SUPABASE_URL=... y -e SUPABASE_CLAVE=... (cópialos de apps/web/.env.local).");
  }
}

function nombreCookie() {
  const m = SUPABASE_URL.match(/^https?:\/\/([^.:/]+)/);
  return `sb-${m ? m[1] : "local"}-auth-token`;
}

export function cookieDeSesion(sesion) {
  if (!sesion.expires_at) sesion.expires_at = Math.floor(Date.now() / 1000) + Number(sesion.expires_in || 3600);
  const valor = "base64-" + encoding.b64encode(JSON.stringify(sesion), "rawurl");
  const nombre = nombreCookie();
  const MAX = 3180;
  if (valor.length <= MAX) return `${nombre}=${valor}`;
  const partes = [];
  for (let i = 0; i * MAX < valor.length; i++) partes.push(`${nombre}.${i}=${valor.slice(i * MAX, (i + 1) * MAX)}`);
  return partes.join("; ");
}

const cabecerasAuth = () => ({ apikey: SUPABASE_CLAVE, "Content-Type": "application/json" });

/**
 * Devuelve la cookie de sesión de una cuenta de jugador de prueba.
 * Si la cuenta no existe, la crea (en Supabase está desactivada la confirmación por correo).
 */
export function sesionDeJugador(correo, clave) {
  exigirSupabase();
  const datos = JSON.stringify({ email: correo, password: clave });
  // 400 = la cuenta todavía no existe (no es una falla de la prueba)
  let r = http.post(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, datos, {
    headers: cabecerasAuth(),
    tags: { name: "preparacion" },
    responseType: "text",
    responseCallback: http.expectedStatuses(200, 400),
  });
  if (r.status !== 200) {
    const alta = JSON.stringify({ email: correo, password: clave, data: { nombre: "Jugador k6", rol: "jugador" } });
    const s = http.post(`${SUPABASE_URL}/auth/v1/signup`, alta, { headers: cabecerasAuth(), tags: { name: "preparacion" }, responseType: "text" });
    if (s.status !== 200) throw new Error(`No se pudo crear ${correo}: ${s.status} ${s.body}`);
    const j = s.json();
    if (j.access_token) return cookieDeSesion(j);
    if (j.session && j.session.access_token) return cookieDeSesion(j.session);
    r = http.post(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, datos, { headers: cabecerasAuth(), tags: { name: "preparacion" }, responseType: "text" });
    if (r.status !== 200) throw new Error(`Se creó ${correo} pero no se pudo iniciar sesión: ${r.status} ${r.body}`);
  }
  return cookieDeSesion(r.json());
}

/** Cuentas de prueba: k6.jugador1@..., k6.jugador2@... (clave con -e K6_CLAVE=...) */
export function cuentasDePrueba(cantidad) {
  const clave = __ENV.K6_CLAVE;
  if (!clave || clave.length < 8) throw new Error("Falta -e K6_CLAVE=... (una clave de al menos 8 caracteres para las cuentas de prueba).");
  const dominio = __ENV.K6_DOMINIO || "reservaya.test";
  const cookies = [];
  for (let i = 1; i <= cantidad; i++) {
    cookies.push(sesionDeJugador(`k6.jugador${i}@${dominio}`, clave));
    sleep(0.3); // Supabase limita los inicios de sesión por minuto
  }
  return cookies;
}
