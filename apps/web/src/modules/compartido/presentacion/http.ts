// Ayudas para las rutas /api (capa de presentación): respuestas JSON de error
// con el mismo formato en todos los endpoints.

import { NextResponse } from "next/server";
import { aErrorAplicacion } from "../infraestructura/supabase/traducir-error";

/** Respuestas que dependen de la sesión: nunca se guardan en caché */
export const SIN_CACHE_PRIVADO = { "Cache-Control": "private, no-store" };
export const SIN_CACHE = { "Cache-Control": "no-store" };

/** { ok: false, error, codigo } con el estado HTTP del error */
export function respuestaError(e: unknown, headers: Record<string, string> = SIN_CACHE_PRIVADO, conOk = true) {
  const err = aErrorAplicacion(e);
  const cuerpo = conOk ? { ok: false, error: err.message, codigo: err.codigo } : { error: err.message, codigo: err.codigo };
  return NextResponse.json(cuerpo, { status: err.status, headers });
}
