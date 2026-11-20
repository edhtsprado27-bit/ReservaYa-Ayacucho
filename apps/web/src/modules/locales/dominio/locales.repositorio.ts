// Puerto (interfaz) de la gestión de locales: QUÉ necesita el módulo, sin decir CÓMO.
// La implementación con Supabase está en infraestructura/ (patrón Repository).

import type { ConfigLocal, EstadoLocal, LocalAdmin } from "./configuracion";
import type { PedidoAjustes, PedidoCancha, PedidoNuevaCancha } from "./pedidos-locales";

export type LocalPropio = { id: string; nombre: string; estado: EstadoLocal };

/** Todo cambio devuelve el slug del local: con él se refresca su página pública */
export type Cambio = { id: string; slug: string };
export type CambioCancha = Cambio & { fueraDeHorario: number };
export type DuenoAsignado = Cambio & { estado: EstadoLocal; dueno: string; correo: string; ahoraEsDueno: boolean };
export type EstadoCambiado = Cambio & { estado: EstadoLocal; reservasFuturas: number };

export interface LocalesRepositorio {
  /** Locales que administra quien tiene la sesión (dueño: los suyos; admin: publicados y suspendidos) */
  misLocales(): Promise<LocalPropio[]>;
  /** Reglas de reserva, canchas, horario y precios de un local */
  config(localId: string): Promise<ConfigLocal>;
  guardarAjustes(localId: string, p: PedidoAjustes): Promise<Cambio>;
  guardarCancha(canchaId: string, p: PedidoCancha): Promise<CambioCancha>;
  agregarCancha(localId: string, p: PedidoNuevaCancha): Promise<Cambio>;
  quitarCancha(canchaId: string): Promise<Cambio>;
  /** Solo admin */
  localesAdmin(): Promise<LocalAdmin[]>;
  asignarDueno(localId: string, correo: string): Promise<DuenoAsignado>;
  cambiarEstado(localId: string, accion: "suspender" | "reactivar", motivo: string | null): Promise<EstadoCambiado>;
}
