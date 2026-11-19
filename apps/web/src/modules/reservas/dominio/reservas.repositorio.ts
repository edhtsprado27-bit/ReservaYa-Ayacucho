// Puerto (interfaz) de las reservas: QUÉ necesita el módulo, sin decir CÓMO.
// La implementación con Supabase está en infraestructura/ (patrón Repository).

import type { PedidoReserva } from "./pedido-reserva";
import type { LocalPublico, Reserva, ReservaCreada, Turno } from "./reserva";

export interface ReservasRepositorio {
  /** Ficha pública del local con sus canchas */
  leerLocal(slug: string): Promise<LocalPublico | null>;
  /** Grilla de un día: libre / ocupado / pasado / cerrado (sin decir quién reservó) */
  disponibilidad(localId: string, fecha: string): Promise<Turno[]>;
  /** Aparta el horario mientras se paga el adelanto. Nunca crea dos reservas cruzadas. */
  reservar(pedido: PedidoReserva): Promise<ReservaCreada>;
  /** Reservas de quien tiene la sesión (todas o una) */
  misReservas(id?: string): Promise<Reserva[]>;
  /** Cancela una reserva propia */
  cancelar(id: string, motivo?: string): Promise<{ conDevolucion: boolean }>;
}
