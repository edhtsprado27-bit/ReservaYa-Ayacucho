// Conversión de lo que devuelve fn_agenda_local a las entidades del dominio.
// Capa: infraestructura.

import { deporteAWeb } from "@/modules/catalogo/dominio/cancha";
import type { EstadoReserva } from "@/modules/reservas/dominio/reserva";
import type { AgendaDia, Bloqueo, CanchaAgenda, OrigenReserva, ReservaAgenda } from "../dominio/agenda";

type Json = Record<string, unknown>;
const lista = (v: unknown) => (Array.isArray(v) ? (v as Json[]) : []);
const num = (v: unknown) => (v == null ? null : Number(v));
const txt = (v: unknown) => (v == null || v === "" ? null : String(v));

const aCancha = (c: Json): CanchaAgenda => ({
  id: String(c.id),
  nombre: String(c.nombre),
  deporte: deporteAWeb(String(c.deporte)) ?? "Multideporte",
  minutosTurno: Number(c.minutos_turno ?? 60),
  turnos: lista(c.turnos).map((t) => ({ inicio: String(t.inicio), fin: String(t.fin), precio: num(t.precio) })),
});

const aReserva = (r: Json): ReservaAgenda => ({
  id: String(r.id),
  codigo: String(r.codigo),
  canchaId: String(r.cancha_id),
  inicio: String(r.inicio),
  fin: String(r.fin),
  estado: String(r.estado) as EstadoReserva,
  origen: String(r.origen) as OrigenReserva,
  jugador: txt(r.jugador),
  telefono: txt(r.telefono),
  total: Number(r.total ?? 0),
  adelanto: Number(r.adelanto ?? 0),
  pagado: Number(r.pagado ?? 0),
  vence: txt(r.vence),
  nota: txt(r.nota),
});

const aBloqueo = (b: Json): Bloqueo => ({
  id: Number(b.id),
  canchaId: String(b.cancha_id),
  inicio: String(b.inicio),
  fin: String(b.fin),
  motivo: txt(b.motivo),
});

export function aAgenda(j: Json): AgendaDia {
  const l = (j.local ?? {}) as Json;
  return {
    local: {
      id: String(l.id),
      nombre: String(l.nombre),
      slug: String(l.slug),
      estado: String(l.estado),
      adelantoPct: Number(l.adelanto_pct ?? 50),
    },
    fecha: String(j.fecha),
    ahora: j.ahora ? String(j.ahora) : new Date(0).toISOString(),
    canchas: lista(j.canchas).map(aCancha),
    reservas: lista(j.reservas).map(aReserva),
    bloqueos: lista(j.bloqueos).map(aBloqueo),
  };
}
