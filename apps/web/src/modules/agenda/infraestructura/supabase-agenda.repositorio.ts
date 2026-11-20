// Agenda del dueño con Supabase (patrón Repository). Siempre con la sesión de
// quien pide: las funciones de PostgreSQL (010_agenda_dueno.sql) comprueban que
// sea el dueño del local o el admin. La tabla bookings sigue cerrada a la API y
// su restricción EXCLUDE impide reservas cruzadas también en las manuales.

import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { traducirErrorReservas } from "@/modules/reservas/infraestructura/traducir-error-reservas";
import type { AgendaDia } from "../dominio/agenda";
import type { AgendaRepositorio, LocalDelDueno, ResultadoAccion } from "../dominio/agenda.repositorio";
import { datosAgendaInvalidos, type PedidoAccion, type PedidoBloqueo, type PedidoReservaManual } from "../dominio/pedidos-agenda";
import { aAgenda } from "./mapeo-agenda";

const traducir = (e: { message?: string; code?: string }) =>
  e.message === "DATOS_INVALIDOS" ? datosAgendaInvalidos() : traducirErrorReservas(e);

export class SupabaseAgendaRepositorio implements AgendaRepositorio {
  constructor(private readonly db: SupabaseClient) {}

  async misLocales(): Promise<LocalDelDueno[]> {
    const { data, error } = await this.db.rpc("fn_mis_locales_pago");
    if (error) throw traducir(error);
    return ((data ?? []) as Record<string, unknown>[]).map((f) => ({
      id: String(f.id),
      nombre: String(f.nombre),
      estado: String(f.estado),
    }));
  }

  async agenda(localId: string, fecha: string): Promise<AgendaDia> {
    const { data, error } = await this.db.rpc("fn_agenda_local", { p_local: localId, p_fecha: fecha });
    if (error) throw traducir(error);
    return aAgenda(data ?? {});
  }

  async reservaManual(p: PedidoReservaManual) {
    const { data, error } = await this.db.rpc("fn_reserva_manual", {
      p_cancha: p.canchaId,
      p_inicio: p.inicio,
      p_fin: p.fin,
      p_nombre: p.nombre,
      p_telefono: p.telefono,
      p_pagado: p.pagado,
      p_nota: p.nota,
    });
    if (error) throw traducir(error);
    return {
      id: String(data.id),
      codigo: String(data.codigo),
      total: Number(data.total),
      pagado: Number(data.pagado),
      estado: String(data.estado ?? "confirmed"),
    };
  }

  async gestionar(reservaId: string, p: PedidoAccion): Promise<ResultadoAccion> {
    const { data, error } = await this.db.rpc("fn_gestionar_reserva", {
      p_reserva: reservaId,
      p_accion: p.accion,
      p_motivo: p.motivo,
      p_monto: p.monto,
    });
    if (error) throw traducir(error);
    return { id: String(data.id), estado: String(data.estado), pagado: Number(data.pagado), total: Number(data.total) };
  }

  async bloquear(p: PedidoBloqueo) {
    const { data, error } = await this.db.rpc("fn_bloquear_horario", {
      p_cancha: p.canchaId,
      p_inicio: p.inicio,
      p_fin: p.fin,
      p_motivo: p.motivo,
    });
    if (error) throw traducir(error);
    return { id: Number(data.id) };
  }

  async quitarBloqueo(id: number) {
    const { error } = await this.db.rpc("fn_quitar_bloqueo", { p_bloqueo: id });
    if (error) throw traducir(error);
  }
}
