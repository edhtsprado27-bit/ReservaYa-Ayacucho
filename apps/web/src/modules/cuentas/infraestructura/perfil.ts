// Perfil de quien navega: nombre, correo y rol (jugador, dueño o admin).
// Si el administrador suspendió la cuenta, no hay perfil (se navega como
// visitante) y se avisa el motivo en /cuenta-suspendida.

import { connection } from "next/server";
import { cache } from "react";
import { crearClienteServidor } from "@/modules/compartido/infraestructura/supabase/cliente-servidor";
import type { Perfil, Rol } from "../dominio/roles";

export { ROL_TEXTO, puedeRegistrarCanchas, type Perfil, type Rol } from "../dominio/roles";

const ROL_BD: Record<string, Rol> = { player: "jugador", owner: "dueno", admin: "admin" };

export type Suspension = { nombre: string; motivo: string | null };
export type Cuenta = { perfil: Perfil | null; suspension: Suspension | null };

const VISITANTE: Cuenta = { perfil: null, suspension: null };

// cache(): si varias partes de la misma página lo piden, se consulta una sola vez
export const obtenerCuenta = cache(async (): Promise<Cuenta> => {
  // Depende de la sesión: se calcula en cada visita (Next 16 lo exige antes de
  // usar cookies o la hora, que Supabase usa para ver si la sesión venció).
  // Va fuera del try para que Next pueda pausar aquí sin que lo atrapemos.
  await connection();
  try {
    const supabase = await crearClienteServidor();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return VISITANTE;

    const { data, error } = await supabase.rpc("fn_mi_perfil");
    const fila = Array.isArray(data) ? data[0] : null;
    if (error || !fila) return VISITANTE;
    if (fila.estado === "suspended") {
      return { perfil: null, suspension: { nombre: String(fila.nombre ?? ""), motivo: fila.motivo ?? null } };
    }
    if (fila.estado !== "active") return VISITANTE;

    return {
      perfil: {
        id: fila.id,
        rol: ROL_BD[fila.rol] ?? "jugador",
        nombre: fila.nombre,
        email: fila.email ?? user.email ?? null,
        telefono: fila.telefono ?? null,
      },
      suspension: null,
    };
  } catch {
    return VISITANTE; // sin Supabase configurado o sin conexión: se navega como visitante
  }
});

/** Perfil de la cuenta activa, o null (visitante o cuenta suspendida) */
export const obtenerPerfil = cache(async (): Promise<Perfil | null> => (await obtenerCuenta()).perfil);
