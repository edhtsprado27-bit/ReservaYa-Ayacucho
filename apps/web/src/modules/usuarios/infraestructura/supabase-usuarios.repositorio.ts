// Gestión de usuarios con Supabase (patrón Repository). Siempre con la sesión
// de quien pide: las funciones fn_usuarios_admin, fn_cambiar_rol y
// fn_cambiar_estado_usuario (012) comprueban que sea el administrador.

import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { crearError } from "@/modules/compartido/dominio/error-aplicacion";
import { aErrorAplicacion } from "@/modules/compartido/infraestructura/supabase/traducir-error";
import type { Rol } from "@/modules/cuentas/dominio/roles";
import type { BusquedaUsuarios, EstadoUsuario, UsuarioAdmin } from "../dominio/usuarios";
import type { UsuariosRepositorio } from "../dominio/usuarios.repositorio";

type Json = Record<string, unknown>;
const ROL_BD: Record<string, Rol> = { player: "jugador", owner: "dueno", admin: "admin" };
const txt = (v: unknown) => (v == null || v === "" ? null : String(v));

// Algunos códigos de la base se comparten con otras pantallas y su mensaje
// habla de otra cosa (correo, reservas): aquí se cambian por uno de cuentas.
const PROPIOS: Record<string, string> = {
  USUARIO_NO_ENCONTRADO: "CUENTA_NO_ENCONTRADA",
  ACCION_NO_PERMITIDA: "CUENTA_SIN_CAMBIO",
};
const traducir = (e: { message?: string; code?: string }) =>
  e.message && e.message in PROPIOS
    ? crearError(PROPIOS[e.message])
    : aErrorAplicacion(Object.assign(new Error(e.message ?? ""), { code: e.code }));

export const aUsuarioAdmin = (f: Json): UsuarioAdmin => ({
  id: String(f.id),
  nombre: String(f.nombre ?? ""),
  correo: txt(f.correo),
  telefono: txt(f.telefono),
  rol: ROL_BD[String(f.rol)] ?? "jugador",
  estado: (f.estado === "suspended" ? "suspended" : "active") as EstadoUsuario,
  motivo: txt(f.motivo),
  creado: String(f.creado),
  ultimoIngreso: txt(f.ultimo_ingreso),
  locales: Number(f.locales ?? 0),
  reservas: Number(f.reservas ?? 0),
  soyYo: Boolean(f.soy_yo),
});

export class SupabaseUsuariosRepositorio implements UsuariosRepositorio {
  constructor(private readonly db: SupabaseClient) {}

  private async llamar(fn: string, params: Json): Promise<unknown> {
    const { data, error } = await this.db.rpc(fn, params);
    if (error) throw traducir(error);
    return data;
  }

  async listar(b: BusquedaUsuarios) {
    const filas = await this.llamar("fn_usuarios_admin", { p_buscar: b.buscar, p_filtro: b.filtro });
    return ((filas ?? []) as Json[]).map(aUsuarioAdmin);
  }

  async cambiarRol(usuarioId: string, rol: "jugador" | "dueno") {
    const d = ((await this.llamar("fn_cambiar_rol", { p_usuario: usuarioId, p_rol: rol })) ?? {}) as Json;
    return { id: String(d.id), rol: d.rol === "dueno" ? ("dueno" as const) : ("jugador" as const), cambio: Boolean(d.cambio) };
  }

  async cambiarEstado(usuarioId: string, accion: "suspender" | "reactivar", motivo: string | null) {
    const d = ((await this.llamar("fn_cambiar_estado_usuario", { p_usuario: usuarioId, p_accion: accion, p_motivo: motivo })) ??
      {}) as Json;
    return {
      id: String(d.id),
      estado: (d.estado === "suspended" ? "suspended" : "active") as EstadoUsuario,
      reservasFuturas: Number(d.reservas_futuras ?? 0),
      localesPublicados: Number(d.locales_publicados ?? 0),
    };
  }
}
