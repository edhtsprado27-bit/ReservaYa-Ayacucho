// Gestión de cuentas por el administrador (RF08): buscar, cambiar entre
// jugador y dueño, suspender con motivo y reactivar.
// Capa: dominio. Tipos y validaciones puras (navegador y servidor).

import { ErrorAplicacion } from "@/modules/compartido/dominio/error-aplicacion";
import type { Rol } from "@/modules/cuentas/dominio/roles";

export type EstadoUsuario = "active" | "suspended";

export const ESTADO_USUARIO_TEXTO: Record<EstadoUsuario, string> = {
  active: "Activa",
  suspended: "Suspendida",
};

/** Fila de la lista /admin/usuarios */
export type UsuarioAdmin = {
  id: string;
  nombre: string;
  correo: string | null;
  telefono: string | null;
  rol: Rol;
  estado: EstadoUsuario;
  motivo: string | null;
  creado: string;
  ultimoIngreso: string | null;
  locales: number;
  reservas: number;
  soyYo: boolean;
};

export const FILTROS_USUARIOS = [
  { codigo: "todos", nombre: "Todas" },
  { codigo: "jugadores", nombre: "Jugadores" },
  { codigo: "duenos", nombre: "Dueños" },
  { codigo: "admins", nombre: "Administradores" },
  { codigo: "suspendidos", nombre: "Suspendidas" },
] as const;
export type FiltroUsuarios = (typeof FILTROS_USUARIOS)[number]["codigo"];

/** Motivos frecuentes para suspender (se puede escribir otro) */
export const MOTIVOS_SUSPENSION = ["Reservas falsas repetidas", "Comprobantes de pago falsos", "Trato ofensivo con un local"];

export type BusquedaUsuarios = { buscar: string | null; filtro: FiltroUsuarios };

export type PedidoUsuario =
  | { accion: "cambiar_rol"; rol: "jugador" | "dueno" }
  | { accion: "suspender"; motivo: string }
  | { accion: "reactivar" };

export const datosUsuarioInvalidos = () =>
  new ErrorAplicacion(
    "DATOS_INVALIDOS_USUARIO",
    400,
    "Acción no válida: cambiar el rol a jugador o dueño, suspender con motivo o reactivar.",
  );

const texto = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** ?buscar=...&filtro=... -> búsqueda válida (lo que no se reconoce vuelve a "todos") */
export function leerBusqueda(buscar: unknown, filtro: unknown): BusquedaUsuarios {
  const f = FILTROS_USUARIOS.find((x) => x.codigo === filtro)?.codigo ?? "todos";
  return { buscar: texto(buscar, 80) || null, filtro: f };
}

export function validarPedidoUsuario(x: unknown): PedidoUsuario {
  const o = x && typeof x === "object" && !Array.isArray(x) ? (x as Record<string, unknown>) : {};
  switch (o.accion) {
    case "cambiar_rol":
      if (o.rol !== "jugador" && o.rol !== "dueno") throw datosUsuarioInvalidos();
      return { accion: "cambiar_rol", rol: o.rol };
    case "suspender":
      // La base exige al menos 3 letras (FALTA_MOTIVO)
      return { accion: "suspender", motivo: texto(o.motivo, 300) };
    case "reactivar":
      return { accion: "reactivar" };
    default:
      throw datosUsuarioInvalidos();
  }
}

const fmtRegistro = new Intl.DateTimeFormat("es-PE", { timeZone: "America/Lima", day: "numeric", month: "short", year: "numeric" });

/** "21 nov 2026" (hora de Ayacucho) */
export const fechaRegistro = (iso: string) => fmtRegistro.format(new Date(iso)).replace(/\./g, "");

/** Instante actual (lo calcula el servidor y lo pasa a la pantalla) */
export const instanteActual = () => new Date().toISOString();

/** "hace 3 días", "hoy", "nunca": para la columna "Último ingreso" */
export function haceCuanto(iso: string | null, ahora: Date = new Date()): string {
  if (!iso) return "nunca";
  const dias = Math.floor((ahora.getTime() - new Date(iso).getTime()) / 86_400_000);
  if (dias <= 0) return "hoy";
  if (dias === 1) return "ayer";
  if (dias < 30) return `hace ${dias} días`;
  const meses = Math.floor(dias / 30);
  return meses === 1 ? "hace 1 mes" : meses < 12 ? `hace ${meses} meses` : "hace más de un año";
}
