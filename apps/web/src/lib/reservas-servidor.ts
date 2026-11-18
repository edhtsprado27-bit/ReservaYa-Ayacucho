// Reservas en Supabase. Solo se usa en el servidor (páginas y rutas /api).
//  - Ficha del local y grilla de horarios: públicas, sin sesión (se cachean).
//  - Reservar, mis reservas y cancelar: con la sesión de quien lo pide; la base
//    de datos sabe quién es (auth.uid()) y nunca muestra reservas ajenas.

import type { SupabaseClient } from "@supabase/supabase-js";
import { cacheLife, cacheTag } from "next/cache";
import { aErrorCatalogo, ErrorCatalogo } from "./catalogo-servidor";
import { getSupabase } from "./supabase";
import {
  aLocal,
  aReserva,
  aReservaCreada,
  aTurno,
  esFechaValida,
  type LocalPublico,
  type Reserva,
  type ReservaCreada,
  type Turno,
} from "./reservas";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SLUG = /^[a-z0-9-]{1,140}$/;

const invalido = () => new ErrorCatalogo("DATOS_INVALIDOS_RESERVA", 400, "Los datos de la reserva no son válidos.");

// ---------------------------------------------------------------------
// Ficha pública del local. Se guarda en caché 1 minuto (cambia poco).
// ---------------------------------------------------------------------
export async function leerLocal(slug: string): Promise<LocalPublico | null> {
  "use cache";
  cacheLife("minutes");
  cacheTag(`local-${slug}`);

  if (!SLUG.test(slug)) return null;
  const { data, error } = await getSupabase().rpc("fn_local_publico", { p_slug: slug });
  if (error) throw traducirRpc(error);
  return data ? aLocal(data) : null;
}

// ---------------------------------------------------------------------
// Grilla de un día. Sin sesión: no dice quién reservó, solo si está tomado.
// ---------------------------------------------------------------------
export async function leerDisponibilidad(localId: string, fecha: string): Promise<Turno[]> {
  if (!UUID.test(localId) || !esFechaValida(fecha)) throw invalido();
  const { data, error } = await getSupabase().rpc("fn_disponibilidad_local", { p_local_id: localId, p_fecha: fecha });
  if (error) throw traducirRpc(error);
  return (data ?? []).map(aTurno);
}

// ---------------------------------------------------------------------
// Reservar: aparta el horario mientras se paga el adelanto
// ---------------------------------------------------------------------
export type PedidoReserva = { canchaId: string; inicio: string; fin: string; clave: string };

export function validarPedido(x: unknown): PedidoReserva {
  const o = (x ?? {}) as Record<string, unknown>;
  const canchaId = String(o.canchaId ?? "");
  const inicio = String(o.inicio ?? "");
  const fin = String(o.fin ?? "");
  const clave = String(o.clave ?? "");
  const fecha = (s: string) => !Number.isNaN(Date.parse(s));
  if (!UUID.test(canchaId) || !fecha(inicio) || !fecha(fin) || !/^[A-Za-z0-9-]{8,64}$/.test(clave)) throw invalido();
  return { canchaId, inicio: new Date(inicio).toISOString(), fin: new Date(fin).toISOString(), clave };
}

export async function reservar(db: SupabaseClient, p: PedidoReserva): Promise<ReservaCreada> {
  const { data, error } = await db.rpc("fn_reservar", {
    p_cancha_id: p.canchaId,
    p_inicio: p.inicio,
    p_fin: p.fin,
    p_clave: p.clave,
  });
  if (error) throw traducirRpc(error);
  return aReservaCreada(data);
}

// ---------------------------------------------------------------------
// Mis reservas (todas o una)
// ---------------------------------------------------------------------
export async function misReservas(db: SupabaseClient, id?: string): Promise<Reserva[]> {
  if (id !== undefined && !UUID.test(id)) return [];
  const { data, error } = await db.rpc("fn_mis_reservas", id ? { p_id: id } : {});
  if (error) throw traducirRpc(error);
  return (data ?? []).map(aReserva);
}

export async function cancelarReserva(db: SupabaseClient, id: string, motivo?: string) {
  if (!UUID.test(id)) throw invalido();
  const { data, error } = await db.rpc("fn_cancelar_reserva", { p_id: id, p_motivo: motivo?.slice(0, 200) ?? null });
  if (error) throw traducirRpc(error);
  return { conDevolucion: Boolean(data?.con_devolucion) };
}

// ---------------------------------------------------------------------
// Errores: los del trigger de la base (en inglés) pasan a nuestros códigos
// ---------------------------------------------------------------------
const DEL_TRIGGER: Record<string, string> = {
  BOOKING_IN_PAST: "HORARIO_PASADO",
  COURT_NOT_BOOKABLE: "CANCHA_NO_DISPONIBLE",
  OUTSIDE_OPERATING_HOURS: "HORARIO_INVALIDO",
  COURT_BLACKOUT: "HORARIO_CERRADO",
};

function traducirRpc(e: { message?: string; code?: string }): ErrorCatalogo {
  const msg = e.message ?? "";
  if (msg === "DATOS_INVALIDOS") return invalido();
  return aErrorCatalogo(Object.assign(new Error(DEL_TRIGGER[msg] ?? msg), { code: e.code }));
}
