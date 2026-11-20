// Puerto (interfaz) de la agenda del dueño: QUÉ necesita el módulo, sin decir CÓMO.
// La implementación con Supabase está en infraestructura/ (patrón Repository).

import type { AgendaDia } from "./agenda";
import type { PedidoAccion, PedidoBloqueo, PedidoReservaManual } from "./pedidos-agenda";

export type LocalDelDueno = { id: string; nombre: string; estado: string };

export type ResultadoAccion = { id: string; estado: string; pagado: number; total: number };

export interface AgendaRepositorio {
  /** Locales que administra quien tiene la sesión (dueño: los suyos; admin: todos los publicados) */
  misLocales(): Promise<LocalDelDueno[]>;
  /** Canchas, turnos, reservas y bloqueos de un local en un día */
  agenda(localId: string, fecha: string): Promise<AgendaDia>;
  /** Reserva anotada por el dueño (llamada o en persona). Queda confirmada. */
  reservaManual(p: PedidoReservaManual): Promise<{ id: string; codigo: string; total: number; pagado: number; estado: string }>;
  /** Cobrar, Jugó, No vino o Cancelar */
  gestionar(reservaId: string, p: PedidoAccion): Promise<ResultadoAccion>;
  /** Cerrar horas de una cancha (mantenimiento, torneo, evento) */
  bloquear(p: PedidoBloqueo): Promise<{ id: number }>;
  quitarBloqueo(id: number): Promise<void>;
}
