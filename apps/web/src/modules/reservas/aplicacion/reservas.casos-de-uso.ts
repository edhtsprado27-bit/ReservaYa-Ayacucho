// Casos de uso de las reservas. Capa: aplicación.
// Validan la entrada con las reglas del dominio y delegan en el repositorio,
// que reciben como parámetro (inversión de dependencias).

import { esSlug, esUUID } from "@/modules/compartido/dominio/validaciones";
import { datosInvalidos, validarPedido } from "../dominio/pedido-reserva";
import type { ReservasRepositorio } from "../dominio/reservas.repositorio";
import { esFechaValida } from "../dominio/tiempo";

/** Ficha del local (null si el slug no es válido o no existe) */
export async function verLocal(repo: ReservasRepositorio, slug: string) {
  if (!esSlug(slug)) return null;
  return repo.leerLocal(slug);
}

/** Grilla de horarios de un local en un día (RF02) */
export function verDisponibilidad(repo: ReservasRepositorio, localId: string, fecha: string) {
  if (!esUUID(localId) || !esFechaValida(fecha)) throw datosInvalidos();
  return repo.disponibilidad(localId, fecha);
}

/** Reservar un horario (RF04). La base de datos garantiza que no haya cruces. */
export function reservarHorario(repo: ReservasRepositorio, datos: unknown) {
  return repo.reservar(validarPedido(datos));
}

/** Mis reservas (RF07). Un id con formato inválido no es de nadie: lista vacía. */
export async function verMisReservas(repo: ReservasRepositorio, id?: string) {
  if (id !== undefined && !esUUID(id)) return [];
  return repo.misReservas(id);
}

/** Cancelar una reserva propia (RF07) */
export function cancelarReserva(repo: ReservasRepositorio, id: string, motivo?: string) {
  if (!esUUID(id)) throw datosInvalidos();
  return repo.cancelar(id, motivo?.slice(0, 200));
}
