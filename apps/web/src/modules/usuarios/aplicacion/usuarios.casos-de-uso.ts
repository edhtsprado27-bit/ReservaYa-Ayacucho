// Casos de uso de la gestión de usuarios (RF08). Capa: aplicación.
// Validan la forma del pedido y delegan en el repositorio. La base revisa que
// quien pide sea admin, que la cuenta no sea de otro admin y deja todo en
// audit_logs (012_servicios_usuarios_whatsapp.sql).

import { esUUID } from "@/modules/compartido/dominio/validaciones";
import { datosUsuarioInvalidos, leerBusqueda, validarPedidoUsuario } from "../dominio/usuarios";
import type { UsuariosRepositorio } from "../dominio/usuarios.repositorio";

/** Lista de cuentas con búsqueda por nombre, correo o celular y filtro por tipo */
export const verUsuarios = (repo: UsuariosRepositorio, buscar?: unknown, filtro?: unknown) =>
  repo.listar(leerBusqueda(buscar, filtro));

/** Cambiar rol (jugador <-> dueño), suspender con motivo o reactivar */
export function gestionarUsuario(repo: UsuariosRepositorio, usuarioId: string, datos: unknown) {
  if (!esUUID(usuarioId)) throw datosUsuarioInvalidos();
  const p = validarPedidoUsuario(datos);
  if (p.accion === "cambiar_rol") return repo.cambiarRol(usuarioId, p.rol);
  return repo.cambiarEstado(usuarioId, p.accion, p.accion === "suspender" ? p.motivo : null);
}
