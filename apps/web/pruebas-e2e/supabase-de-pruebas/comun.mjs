// Configuración y utilidades compartidas del Supabase de pruebas (servidor y
// preparación de la base). Todo es solo para pruebas: la clave del JWT y las
// contraseñas de las cuentas de prueba no sirven para nada fuera de esta base.

import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

export const URL_BASE_DATOS =
  process.env.E2E_DATABASE_URL ?? "postgres://postgres:postgres@127.0.0.1:5432/reservaya_e2e";
export const PUERTO = Number(process.env.E2E_SUPABASE_PUERTO ?? 54321);
export const SECRETO_JWT = process.env.E2E_SECRETO_JWT ?? "solo-para-pruebas-e2e-no-es-un-secreto";
export const CLAVE_CUENTAS = "Prueba-E2E-2026";

/** Contraseña -> "scrypt$sal$hash" (como bcrypt en Supabase Auth: nunca se guarda en claro) */
export function cifrarClave(clave) {
  const sal = randomBytes(16).toString("hex");
  return `scrypt$${sal}$${scryptSync(clave, sal, 32).toString("hex")}`;
}

export function claveCorrecta(clave, guardada) {
  const [tipo, sal, hash] = String(guardada ?? "").split("$");
  if (tipo !== "scrypt" || !sal || !hash) return false;
  const calculado = scryptSync(String(clave), sal, 32);
  return timingSafeEqual(calculado, Buffer.from(hash, "hex"));
}

const b64 = (x) => Buffer.from(typeof x === "string" ? x : JSON.stringify(x)).toString("base64url");

/** JWT HS256 (mismo formato que entrega Supabase Auth) */
export function firmarJWT(datos) {
  const cabeza = b64({ alg: "HS256", typ: "JWT" });
  const cuerpo = b64(datos);
  const firma = createHmac("sha256", SECRETO_JWT).update(`${cabeza}.${cuerpo}`).digest("base64url");
  return `${cabeza}.${cuerpo}.${firma}`;
}

/** Devuelve el contenido del JWT si la firma es válida y no venció; si no, null */
export function leerJWT(token) {
  const [cabeza, cuerpo, firma] = String(token ?? "").split(".");
  if (!cabeza || !cuerpo || !firma) return null;
  const esperada = createHmac("sha256", SECRETO_JWT).update(`${cabeza}.${cuerpo}`).digest("base64url");
  if (firma.length !== esperada.length || !timingSafeEqual(Buffer.from(firma), Buffer.from(esperada))) return null;
  try {
    const datos = JSON.parse(Buffer.from(cuerpo, "base64url").toString());
    return datos.exp && datos.exp * 1000 > Date.now() ? datos : null;
  } catch {
    return null;
  }
}
