// Traduce lo que responde Supabase (PostgREST / PostgreSQL) a los códigos de
// error de la aplicación. Capa: infraestructura (conoce los códigos de Supabase).

import { crearError, ErrorAplicacion, MENSAJES } from "../../dominio/error-aplicacion";

export function traducirErrorSupabase(e: { message?: string; code?: string } | null | undefined): ErrorAplicacion {
  const msg = e?.message ?? "";
  const code = e?.code ?? "";
  if (msg in MENSAJES) return crearError(msg);
  if (code === "PGRST202" || code === "42883") return crearError("FALTA_MIGRACION");
  if (code === "42501" || /permission denied/i.test(msg)) return crearError("SIN_SESION");
  if (/invalid api key|jwt|apikey|unauthorized/i.test(msg) || code === "PGRST301") return crearError("CLAVE_INVALIDA");
  if (/fetch failed|enotfound|econnrefused|network|getaddrinfo/i.test(msg)) return crearError("SIN_CONEXION");
  return crearError("DESCONOCIDO", `${code} ${msg}`);
}

/** Cualquier error (de Supabase, de red o nuestro) -> ErrorAplicacion */
export function aErrorAplicacion(e: unknown): ErrorAplicacion {
  if (e instanceof ErrorAplicacion) return e;
  if (e instanceof Error && e.message in MENSAJES) return crearError(e.message);
  if (e instanceof Error) return traducirErrorSupabase({ message: e.message, code: (e as { code?: string }).code });
  return crearError("DESCONOCIDO", String(e));
}
