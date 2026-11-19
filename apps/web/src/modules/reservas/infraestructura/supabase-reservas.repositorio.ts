// Implementación de las reservas con Supabase (patrón Repository).
// Todo pasa por funciones SECURITY DEFINER de PostgreSQL (007_reservas.sql):
// la tabla bookings no se abre a la API. La restricción EXCLUDE de esa tabla
// es la garantía final de que nunca haya dos reservas cruzadas.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { PedidoReserva } from "../dominio/pedido-reserva";
import type { ReservasRepositorio } from "../dominio/reservas.repositorio";
import type { LocalPublico, Reserva, ReservaCreada, Turno } from "../dominio/reserva";
import { leerLocalEnCache } from "./local-publico-en-cache";
import { aReserva, aReservaCreada, aTurno } from "./mapeo-reservas";
import { traducirErrorReservas } from "./traducir-error-reservas";

export class SupabaseReservasRepositorio implements ReservasRepositorio {
  /** db: cliente sin sesión (lo público) o con la sesión de quien pide (lo personal) */
  constructor(private readonly db: SupabaseClient) {}

  leerLocal(slug: string): Promise<LocalPublico | null> {
    return leerLocalEnCache(slug);
  }

  async disponibilidad(localId: string, fecha: string): Promise<Turno[]> {
    const { data, error } = await this.db.rpc("fn_disponibilidad_local", { p_local_id: localId, p_fecha: fecha });
    if (error) throw traducirErrorReservas(error);
    return (data ?? []).map(aTurno);
  }

  async reservar(p: PedidoReserva): Promise<ReservaCreada> {
    const { data, error } = await this.db.rpc("fn_reservar", {
      p_cancha_id: p.canchaId,
      p_inicio: p.inicio,
      p_fin: p.fin,
      p_clave: p.clave,
    });
    if (error) throw traducirErrorReservas(error);
    return aReservaCreada(data);
  }

  async misReservas(id?: string): Promise<Reserva[]> {
    const { data, error } = await this.db.rpc("fn_mis_reservas", id ? { p_id: id } : {});
    if (error) throw traducirErrorReservas(error);
    return (data ?? []).map(aReserva);
  }

  async cancelar(id: string, motivo?: string) {
    const { data, error } = await this.db.rpc("fn_cancelar_reserva", { p_id: id, p_motivo: motivo ?? null });
    if (error) throw traducirErrorReservas(error);
    return { conDevolucion: Boolean(data?.con_devolucion) };
  }
}
