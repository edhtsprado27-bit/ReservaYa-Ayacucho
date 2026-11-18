// Acceso al catálogo en Supabase. Solo se usa en el servidor (src/app/api/...).
//  - Leer el catálogo público: cliente sin sesión (se puede cachear).
//  - Registrar, editar, quitar o aprobar: cliente CON la sesión de quien lo pide,
//    así la base de datos sabe si es dueño o admin (auth.uid()).

import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabase } from "./supabase";
import { deporteABD, filaACancha, type CanchaBD, type FilaCatalogo, type NuevaCancha } from "./canchas-db";

// ---------------------------------------------------------------------
// Errores con mensaje claro para la pantalla
// ---------------------------------------------------------------------
const MENSAJES: Record<string, { mensaje: string; status: number }> = {
  FALTA_CONFIGURAR_SUPABASE: {
    mensaje: "Falta configurar Supabase: revisa el archivo apps/web/.env.local y reinicia npm run dev.",
    status: 500,
  },
  SIN_CONEXION: {
    mensaje: "No se pudo conectar con Supabase. Revisa la URL en .env.local y tu conexión a internet.",
    status: 502,
  },
  CLAVE_INVALIDA: {
    mensaje: "Supabase rechazó la clave. Copia de nuevo la clave publishable (o anon) en .env.local.",
    status: 502,
  },
  FALTA_MIGRACION: {
    mensaje:
      "Supabase no tiene las funciones nuevas. Ejecuta las migraciones 004 a 007 en el SQL Editor.",
    status: 502,
  },
  SIN_SESION: { mensaje: "Inicia sesión para continuar.", status: 401 },
  SOLO_DUENOS: {
    mensaje: "Solo las cuentas de dueño o administrador pueden registrar canchas.",
    status: 403,
  },
  SOLO_ADMIN: { mensaje: "Solo el administrador puede aprobar o rechazar canchas.", status: 403 },
  DATOS_INVALIDOS: { mensaje: "Faltan datos de la cancha (nombre, distrito y ubicación).", status: 400 },
  NOMBRE_INVALIDO: { mensaje: "El nombre debe tener entre 3 y 120 caracteres.", status: 400 },
  FUERA_DE_HUAMANGA: { mensaje: "La ubicación está fuera de la provincia de Huamanga.", status: 400 },
  DISTRITO_NO_ENCONTRADO: { mensaje: "No reconocemos ese distrito.", status: 400 },
  DISTRITO_NO_ACTIVO: { mensaje: "Ese distrito todavía no está habilitado.", status: 400 },
  DISTRICT_NOT_ACTIVE: { mensaje: "Ese distrito todavía no está habilitado.", status: 400 },
  PRECIO_INVALIDO: { mensaje: "El precio por hora debe estar entre S/ 1 y S/ 1000.", status: 400 },
  LOCAL_DUPLICADO: { mensaje: "Ya existe una cancha con ese nombre en el distrito o en ese mismo punto.", status: 409 },
  PROPUESTA_NO_ENCONTRADA: {
    mensaje: "Esa cancha ya fue revisada o ya no existe. Recarga la página.",
    status: 404,
  },
  DEMASIADAS_PROPUESTAS: {
    mensaje: "Se registraron demasiadas canchas en la última hora. Intenta más tarde.",
    status: 429,
  },
  // Reservas (paso 5)
  CANCHA_NO_DISPONIBLE: { mensaje: "Esta cancha no está recibiendo reservas ahora.", status: 409 },
  HORARIO_OCUPADO: {
    mensaje: "Alguien acaba de reservar ese horario. Elige otra hora: la grilla ya está actualizada.",
    status: 409,
  },
  HORARIO_PASADO: { mensaje: "Esa hora ya pasó. Elige una hora que todavía no haya empezado.", status: 400 },
  HORARIO_INVALIDO: { mensaje: "Elige horas seguidas dentro del horario de atención de la cancha.", status: 400 },
  HORARIO_CERRADO: { mensaje: "La cancha está cerrada en ese horario (mantenimiento o evento).", status: 409 },
  DURACION_INVALIDA: { mensaje: "Esa cantidad de horas no está permitida en esta cancha.", status: 400 },
  FECHA_MUY_LEJANA: { mensaje: "Solo se puede reservar hasta 30 días antes.", status: 400 },
  SIN_TARIFA: {
    mensaje: "Esta cancha todavía no publicó su precio. Llama al local para reservar.",
    status: 409,
  },
  DEMASIADAS_PENDIENTES: {
    mensaje: "Ya tienes 2 reservas por pagar. Paga o cancela una antes de apartar otra hora.",
    status: 429,
  },
  RESERVA_NO_ENCONTRADA: { mensaje: "No encontramos esa reserva en tu cuenta.", status: 404 },
  RESERVA_VENCIDA: { mensaje: "Esta reserva ya venció y el horario se liberó.", status: 409 },
  NO_SE_PUEDE_CANCELAR: { mensaje: "Esta reserva ya no se puede cancelar.", status: 409 },
  DESCONOCIDO: { mensaje: "Ocurrió un error con la base de datos. Inténtalo de nuevo.", status: 500 },
};

export class ErrorCatalogo extends Error {
  constructor(
    public codigo: string,
    public status: number,
    mensaje: string,
  ) {
    super(mensaje);
  }
}

function crearError(codigo: string, detalle?: string): ErrorCatalogo {
  const m = MENSAJES[codigo] ?? MENSAJES.DESCONOCIDO;
  if (codigo === "DESCONOCIDO" && detalle) console.error("[catalogo] Supabase:", detalle);
  return new ErrorCatalogo(codigo in MENSAJES ? codigo : "DESCONOCIDO", m.status, m.mensaje);
}

// Traduce lo que responde Supabase a uno de nuestros códigos
function traducir(e: { message?: string; code?: string } | null | undefined): ErrorCatalogo {
  const msg = e?.message ?? "";
  const code = e?.code ?? "";
  if (msg in MENSAJES) return crearError(msg);
  if (code === "PGRST202" || code === "42883") return crearError("FALTA_MIGRACION");
  if (code === "42501" || /permission denied/i.test(msg)) return crearError("SIN_SESION");
  if (/invalid api key|jwt|apikey|unauthorized/i.test(msg) || code === "PGRST301") return crearError("CLAVE_INVALIDA");
  if (/fetch failed|enotfound|econnrefused|network|getaddrinfo/i.test(msg)) return crearError("SIN_CONEXION");
  return crearError("DESCONOCIDO", `${code} ${msg}`);
}

export function aErrorCatalogo(e: unknown): ErrorCatalogo {
  if (e instanceof ErrorCatalogo) return e;
  if (e instanceof Error && e.message in MENSAJES) return crearError(e.message);
  if (e instanceof Error) return traducir({ message: e.message, code: (e as { code?: string }).code });
  return crearError("DESCONOCIDO", String(e));
}

// ---------------------------------------------------------------------
// Lectura del catálogo, con caché en memoria
//   - Varias visitas seguidas comparten una sola consulta a Supabase.
//   - La ruta /api/canchas además pide caché al CDN (Vercel) por 60 s.
//   - En el paso 10 esta caché pasa a Redis (Upstash).
// ---------------------------------------------------------------------
const TTL_MS = 30_000;
let cache: { canchas: CanchaBD[]; generado: string; expira: number } | null = null;
let enCurso: Promise<{ canchas: CanchaBD[]; generado: string }> | null = null;

export async function leerCatalogo(): Promise<{ canchas: CanchaBD[]; generado: string }> {
  if (cache && cache.expira > Date.now()) return cache;
  if (enCurso) return enCurso;

  enCurso = (async () => {
    const { data, error } = await getSupabase().rpc("fn_catalogo_canchas");
    if (error) throw traducir(error);
    const canchas = ((data ?? []) as FilaCatalogo[]).map(filaACancha);
    const generado = new Date().toISOString();
    cache = { canchas, generado, expira: Date.now() + TTL_MS };
    return { canchas, generado };
  })();

  try {
    return await enCurso;
  } finally {
    enCurso = null;
  }
}

// ---------------------------------------------------------------------
// Registro de una cancha nueva (queda en revisión)
// ---------------------------------------------------------------------
export function validarNuevaCancha(x: unknown): NuevaCancha {
  const o = (x ?? {}) as Record<string, unknown>;
  const texto = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);
  const numero = (v: unknown) => {
    const n = typeof v === "string" ? Number(v.replace(",", ".")) : v;
    return typeof n === "number" && Number.isFinite(n) ? n : undefined;
  };

  const nombre = texto(o.nombre);
  const distrito = texto(o.distrito);
  const lat = numero(o.lat);
  const lng = numero(o.lng);
  if (!nombre || !distrito || lat === undefined || lng === undefined) throw crearError("DATOS_INVALIDOS");

  const precio = numero(o.precioDesde);
  return {
    nombre,
    distrito,
    lat,
    lng,
    direccion: texto(o.direccion),
    referencia: texto(o.referencia),
    deportes: Array.isArray(o.deportes)
      ? (o.deportes.filter((d) => typeof d === "string") as NuevaCancha["deportes"])
      : undefined,
    techada: o.techada === true,
    precioDesde: precio && precio > 0 ? precio : undefined,
    telefono: texto(o.telefono),
  };
}

function parametrosRpc(c: NuevaCancha) {
  const deportes = (c.deportes ?? []).map((d) => deporteABD(d)).filter((d): d is string => d !== null);
  return {
    p_nombre: c.nombre,
    p_distrito: c.distrito,
    p_lat: c.lat,
    p_lng: c.lng,
    p_direccion: c.direccion ?? null,
    p_referencia: c.referencia ?? null,
    p_deportes: deportes.length ? deportes : ["futbol"],
    p_techada: c.techada ?? false,
    p_precio: c.precioDesde ?? null,
    p_telefono: c.telefono ?? null,
  };
}

type Registro = { id: string; slug: string; estado: string };

export async function proponerLocal(db: SupabaseClient, c: NuevaCancha): Promise<Registro> {
  const { data, error } = await db.rpc("fn_proponer_local", parametrosRpc(c));
  if (error) throw traducir(error);
  return data as Registro;
}

// ---------------------------------------------------------------------
// Corregir o quitar una cancha que sigue en revisión (005_web_propuestas.sql)
// ---------------------------------------------------------------------
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function validarId(id: string): string {
  if (!UUID.test(id)) throw crearError("PROPUESTA_NO_ENCONTRADA");
  return id;
}

export async function reemplazarPropuesta(db: SupabaseClient, id: string, c: NuevaCancha): Promise<Registro> {
  const { data, error } = await db.rpc("fn_reemplazar_propuesta", { p_id: id, ...parametrosRpc(c) });
  if (error) throw traducir(error);
  return data as Registro;
}

export async function retirarPropuesta(db: SupabaseClient, id: string): Promise<void> {
  const { error } = await db.rpc("fn_retirar_propuesta", { p_id: id });
  if (error) throw traducir(error);
}

// ---------------------------------------------------------------------
// Canchas en revisión (006_auth_roles.sql)
//   Dueño: las suyas. Admin: todas.
// ---------------------------------------------------------------------
export async function listarPendientes(db: SupabaseClient): Promise<CanchaBD[]> {
  const { data, error } = await db.rpc("fn_mis_pendientes");
  if (error) throw traducir(error);
  return ((data ?? []) as FilaCatalogo[]).map(filaACancha);
}

// Aprobar o rechazar (solo admin). Al aprobar, el catálogo se renueva al instante.
export async function revisarLocal(db: SupabaseClient, id: string, aprobar: boolean, motivo?: string) {
  const { data, error } = await db.rpc("fn_revisar_local", { p_id: id, p_aprobar: aprobar, p_motivo: motivo ?? null });
  if (error) throw traducir(error);
  if (aprobar) cache = null;
  return data as { id: string; nombre: string; estado: string };
}
