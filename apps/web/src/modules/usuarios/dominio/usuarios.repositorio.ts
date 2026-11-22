// Puerto (interfaz) de la gestión de usuarios: QUÉ necesita el módulo.
// La implementación con Supabase está en infraestructura/ (patrón Repository).

import type { BusquedaUsuarios, EstadoUsuario, UsuarioAdmin } from "./usuarios";

export type RolCambiado = { id: string; rol: "jugador" | "dueno"; cambio: boolean };
export type EstadoCambiado = { id: string; estado: EstadoUsuario; reservasFuturas: number; localesPublicados: number };

export interface UsuariosRepositorio {
  /** Hasta 100 cuentas, las más recientes primero (solo admin) */
  listar(b: BusquedaUsuarios): Promise<UsuarioAdmin[]>;
  cambiarRol(usuarioId: string, rol: "jugador" | "dueno"): Promise<RolCambiado>;
  cambiarEstado(usuarioId: string, accion: "suspender" | "reactivar", motivo: string | null): Promise<EstadoCambiado>;
}
