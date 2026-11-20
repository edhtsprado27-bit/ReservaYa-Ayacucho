// Casos de uso de la agenda del dueño. Capa: aplicación.
// Validan la forma de los datos y delegan en el repositorio, que reciben como
// parámetro (inversión de dependencias). La base de datos decide si quien pide
// es el dueño del local (o el admin) y si el horario está libre.

import { esUUID } from "@/modules/compartido/dominio/validaciones";
import { esFechaValida } from "@/modules/reservas/dominio/tiempo";
import type { AgendaRepositorio } from "../dominio/agenda.repositorio";
import {
  datosAgendaInvalidos,
  validarAccion,
  validarBloqueo,
  validarIdBloqueo,
  validarReservaManual,
} from "../dominio/pedidos-agenda";

/**
 * Locales con agenda: los publicados y también los suspendidos (no reciben
 * reservas nuevas, pero el dueño debe atender o cancelar las que ya tenía)
 */
export async function verLocalesConAgenda(repo: AgendaRepositorio) {
  return (await repo.misLocales()).filter((l) => l.estado === "approved" || l.estado === "suspended");
}

/** Agenda de un día (RF: el dueño ve sus reservas) */
export function verAgenda(repo: AgendaRepositorio, localId: string, fecha: string) {
  if (!esUUID(localId) || !esFechaValida(fecha)) throw datosAgendaInvalidos();
  return repo.agenda(localId, fecha);
}

/** Anotar una reserva hecha por teléfono o en persona */
export function anotarReserva(repo: AgendaRepositorio, datos: unknown) {
  return repo.reservaManual(validarReservaManual(datos));
}

/** Cobrar, Jugó, No vino o Cancelar (con motivo) */
export function gestionarReserva(repo: AgendaRepositorio, reservaId: string, datos: unknown) {
  if (!esUUID(reservaId)) throw datosAgendaInvalidos();
  return repo.gestionar(reservaId, validarAccion(datos));
}

/** Cerrar horas de una cancha */
export function bloquearHorario(repo: AgendaRepositorio, datos: unknown) {
  return repo.bloquear(validarBloqueo(datos));
}

/** Volver a abrir horas bloqueadas */
export function quitarBloqueo(repo: AgendaRepositorio, id: string) {
  return repo.quitarBloqueo(validarIdBloqueo(id));
}
