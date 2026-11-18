// Perfil de quien navega: nombre, correo y rol (jugador, dueño o admin).

import { connection } from "next/server";
import { cache } from "react";
import { crearClienteServidor } from "./servidor";
import type { Perfil, Rol } from "./roles";

export { ROL_TEXTO, puedeRegistrarCanchas, type Perfil, type Rol } from "./roles";

const ROL_BD: Record<string, Rol> = { player: "jugador", owner: "dueno", admin: "admin" };

// cache(): si varias partes de la misma página lo piden, se consulta una sola vez
export const obtenerPerfil = cache(async (): Promise<Perfil | null> => {
  // Depende de la sesión: se calcula en cada visita (Next 16 lo exige antes de
  // usar cookies o la hora, que Supabase usa para ver si la sesión venció).
  // Va fuera del try para que Next pueda pausar aquí sin que lo atrapemos.
  await connection();
  try {
    const supabase = await crearClienteServidor();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase.rpc("fn_mi_perfil");
    const fila = Array.isArray(data) ? data[0] : null;
    if (error || !fila || fila.estado !== "active") return null;

    return {
      id: fila.id,
      rol: ROL_BD[fila.rol] ?? "jugador",
      nombre: fila.nombre,
      email: fila.email ?? user.email ?? null,
      telefono: fila.telefono ?? null,
    };
  } catch {
    return null; // sin Supabase configurado o sin conexión: se navega como visitante
  }
});
