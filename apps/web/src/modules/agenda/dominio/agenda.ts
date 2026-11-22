// Agenda del dueño: entidades y reglas puras. Capa: dominio
// (no depende de Next.js ni de Supabase; se prueba con pruebas unitarias).

import type { EstadoReserva } from "@/modules/reservas/dominio/reserva";

export type TurnoAgenda = { inicio: string; fin: string; precio: number | null };

export type CanchaAgenda = {
  id: string;
  nombre: string;
  deporte: string;
  minutosTurno: number;
  turnos: TurnoAgenda[];
};

export type OrigenReserva = "web" | "mobile" | "chatbot" | "whatsapp" | "owner_manual";

export type ReservaAgenda = {
  id: string;
  codigo: string;
  canchaId: string;
  inicio: string;
  fin: string;
  estado: EstadoReserva;
  origen: OrigenReserva;
  jugador: string | null;
  telefono: string | null;
  total: number;
  adelanto: number;
  pagado: number;
  vence: string | null;
  nota: string | null;
};

export type Bloqueo = { id: number; canchaId: string; inicio: string; fin: string; motivo: string | null };

export type AgendaDia = {
  local: { id: string; nombre: string; slug: string; estado: string; adelantoPct: number };
  fecha: string;
  ahora: string; // hora de la base de datos al armar la agenda
  canchas: CanchaAgenda[];
  reservas: ReservaAgenda[];
  bloqueos: Bloqueo[];
};

export type AccionReserva = "cobrar" | "jugo" | "no_vino" | "cancelar";

export const ACCION_TEXTO: Record<AccionReserva, string> = {
  cobrar: "Cobrar",
  jugo: "Jugó",
  no_vino: "No vino",
  cancelar: "Cancelar",
};

export const ORIGEN_TEXTO: Record<OrigenReserva, string> = {
  web: "Web",
  mobile: "App",
  chatbot: "Chat",
  whatsapp: "WhatsApp",
  owner_manual: "Anotada por el local",
};

const ms = (iso: string) => new Date(iso).getTime();
const cruza = (a: { inicio: string; fin: string }, b: { inicio: string; fin: string }) =>
  ms(a.inicio) < ms(b.fin) && ms(a.fin) > ms(b.inicio);
const activa = (e: EstadoReserva) => e === "pending_payment" || e === "payment_review" || e === "confirmed";

/** Lo que falta cobrar de una reserva */
export const saldo = (r: Pick<ReservaAgenda, "total" | "pagado">) => Math.max(0, Math.round((r.total - r.pagado) * 100) / 100);

/**
 * Acciones que el dueño puede hacer con una reserva en este momento
 * (las mismas reglas que valida la base de datos en fn_gestionar_reserva).
 */
export function accionesPosibles(r: ReservaAgenda, ahora: number): AccionReserva[] {
  const empezo = ms(r.inicio) <= ahora;
  const termino = ms(r.fin) <= ahora;
  const acciones: AccionReserva[] = [];
  if ((activa(r.estado) || r.estado === "completed") && saldo(r) > 0) acciones.push("cobrar");
  if (activa(r.estado) && empezo) acciones.push("jugo", "no_vino");
  if (activa(r.estado) && !termino) acciones.push("cancelar");
  return acciones;
}

export type FilaAgenda =
  | { tipo: "libre"; turno: TurnoAgenda; pasado: boolean }
  | { tipo: "reserva"; reserva: ReservaAgenda }
  | { tipo: "bloqueo"; bloqueo: Bloqueo };

/**
 * Filas de la agenda de una cancha: cada turno libre es una fila; una reserva o
 * un bloqueo que ocupa varios turnos se muestra UNA sola vez, en su primer turno.
 * Las reservas que quedaron fuera de los turnos (p. ej. si cambió el horario)
 * se agregan igual, ordenadas por hora.
 */
export function filasDeCancha(agenda: AgendaDia, canchaId: string, ahora: number): FilaAgenda[] {
  const cancha = agenda.canchas.find((c) => c.id === canchaId);
  const reservas = agenda.reservas.filter((r) => r.canchaId === canchaId);
  const bloqueos = agenda.bloqueos.filter((b) => b.canchaId === canchaId);
  const filas: FilaAgenda[] = [];
  const puestas = new Set<string>();
  const puestos = new Set<number>();

  for (const t of cancha?.turnos ?? []) {
    const r = reservas.find((x) => cruza(x, t));
    if (r) {
      if (!puestas.has(r.id)) filas.push({ tipo: "reserva", reserva: r });
      puestas.add(r.id);
      continue;
    }
    const b = bloqueos.find((x) => cruza(x, t));
    if (b) {
      if (!puestos.has(b.id)) filas.push({ tipo: "bloqueo", bloqueo: b });
      puestos.add(b.id);
      continue;
    }
    filas.push({ tipo: "libre", turno: t, pasado: ms(t.inicio) <= ahora });
  }

  for (const r of reservas) if (!puestas.has(r.id)) filas.push({ tipo: "reserva", reserva: r });
  const inicioDe = (f: FilaAgenda) => ms(f.tipo === "libre" ? f.turno.inicio : f.tipo === "reserva" ? f.reserva.inicio : f.bloqueo.inicio);
  return filas.sort((a, b) => inicioDe(a) - inicioDe(b));
}

/**
 * Turnos libres seguidos desde un turno (para elegir "hasta qué hora" al
 * reservar o bloquear). Se detiene en la primera reserva o bloqueo, o al llegar
 * al máximo de minutos.
 */
export function turnosSeguidosLibres(agenda: AgendaDia, canchaId: string, desde: string, maxMinutos = 240): TurnoAgenda[] {
  const cancha = agenda.canchas.find((c) => c.id === canchaId);
  if (!cancha) return [];
  const ocupado = (t: TurnoAgenda) =>
    agenda.reservas.some((r) => r.canchaId === canchaId && cruza(r, t)) ||
    agenda.bloqueos.some((b) => b.canchaId === canchaId && cruza(b, t));
  const i = cancha.turnos.findIndex((t) => t.inicio === desde);
  if (i < 0) return [];
  const lista: TurnoAgenda[] = [];
  for (let k = i; k < cancha.turnos.length; k++) {
    const t = cancha.turnos[k];
    if (ocupado(t)) break;
    if (lista.length && ms(lista[lista.length - 1].fin) !== ms(t.inicio)) break;
    if ((ms(t.fin) - ms(cancha.turnos[i].inicio)) / 60_000 > maxMinutos) break;
    lista.push(t);
  }
  return lista;
}

/** Precio de varios turnos seguidos (los turnos sin precio cuentan 0) */
export function precioDeTurnos(turnos: TurnoAgenda[], minutosTurno: number): number {
  const total = turnos.reduce((s, t) => s + (t.precio ?? 0) * (minutosTurno / 60), 0);
  return Math.round(total * 100) / 100;
}

/** Resumen del día: reservas que siguen en pie o ya se jugaron, total, cobrado y por cobrar */
export function resumenDelDia(agenda: AgendaDia) {
  const cuentan = agenda.reservas.filter((r) => activa(r.estado) || r.estado === "completed");
  const total = cuentan.reduce((s, r) => s + r.total, 0);
  const cobrado = cuentan.reduce((s, r) => s + r.pagado, 0);
  const redondo = (n: number) => Math.round(n * 100) / 100;
  return {
    reservas: cuentan.length,
    porConfirmar: cuentan.filter((r) => r.estado === "pending_payment" || r.estado === "payment_review").length,
    total: redondo(total),
    cobrado: redondo(cobrado),
    porCobrar: redondo(total - cobrado),
  };
}

/** Celular para WhatsApp: 51 + 9 dígitos (o null). Ahora vive en compartido (RF15) */
export { enlaceWhatsApp } from "@/modules/compartido/dominio/whatsapp";
