// Conversión de las filas que devuelven las funciones de Supabase a las
// entidades del dominio. Capa: infraestructura.

import { deporteAWeb } from "@/modules/catalogo/dominio/cancha";
import type { EstadoReserva, EstadoTurno, LocalPublico, Reserva, ReservaCreada, Turno } from "../dominio/reserva";

type Json = Record<string, unknown>;
const num = (v: unknown) => (v == null ? null : Number(v));
const txt = (v: unknown) => (v == null ? null : String(v));

export function aLocal(j: Json): LocalPublico {
  const canchas = Array.isArray(j.canchas) ? (j.canchas as Json[]) : [];
  return {
    id: String(j.id),
    slug: String(j.slug),
    nombre: String(j.nombre),
    distrito: String(j.distrito),
    direccion: String(j.direccion ?? ""),
    referencia: txt(j.referencia),
    lat: Number(j.lat),
    lng: Number(j.lng),
    telefono: txt(j.telefono),
    adelantoPct: Number(j.adelanto_pct ?? 50),
    minutosApartado: Number(j.minutos_apartado ?? 15),
    horasCancelacion: Number(j.horas_cancelacion ?? 6),
    canchas: canchas.map((c) => ({
      id: String(c.id),
      nombre: String(c.nombre),
      deporte: deporteAWeb(String(c.deporte)) ?? "Multideporte",
      techada: Boolean(c.techada),
      minutosTurno: Number(c.minutos_turno ?? 60),
      minMinutos: Number(c.min_minutos ?? 60),
      maxMinutos: Number(c.max_minutos ?? 180),
      precioDesde: num(c.precio_desde),
    })),
  };
}

export function aTurno(f: Json): Turno {
  return {
    cancha: String(f.cancha_id),
    inicio: String(f.inicio),
    fin: String(f.fin),
    estado: String(f.estado) as EstadoTurno,
    precio: num(f.precio),
  };
}

export function aReserva(f: Json): Reserva {
  return {
    id: String(f.id),
    codigo: String(f.codigo),
    estado: String(f.estado) as EstadoReserva,
    inicio: String(f.inicio),
    fin: String(f.fin),
    total: Number(f.total),
    adelanto: Number(f.adelanto),
    pagado: Number(f.pagado ?? 0),
    vence: txt(f.vence),
    cancha: String(f.cancha),
    deporte: deporteAWeb(String(f.deporte)) ?? "Multideporte",
    local: String(f.local),
    slug: String(f.slug),
    distrito: String(f.distrito),
    direccion: String(f.direccion ?? ""),
    referencia: txt(f.referencia),
    lat: num(f.lat),
    lng: num(f.lng),
    telefono: txt(f.telefono),
    horasCancelacion: Number(f.horas_cancelacion ?? 6),
    cancelable: Boolean(f.cancelable),
  };
}

export function aReservaCreada(j: Json): ReservaCreada {
  return {
    id: String(j.id),
    codigo: String(j.codigo),
    estado: String(j.estado) as EstadoReserva,
    inicio: String(j.inicio),
    fin: String(j.fin),
    total: Number(j.total),
    adelanto: Number(j.adelanto),
    vence: txt(j.vence),
  };
}
