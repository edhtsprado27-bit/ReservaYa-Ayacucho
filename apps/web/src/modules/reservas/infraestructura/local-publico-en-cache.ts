// Ficha pública del local, guardada en la caché de Next.js 1 minuto ("use cache").
// Cambia poco y la ven muchas personas: así no se consulta la base en cada visita.

import { cacheLife, cacheTag } from "next/cache";
import { getSupabase } from "@/modules/compartido/infraestructura/supabase/cliente-publico";
import type { LocalPublico } from "../dominio/reserva";
import { aLocal } from "./mapeo-reservas";
import { traducirErrorReservas } from "./traducir-error-reservas";

export async function leerLocalEnCache(slug: string): Promise<LocalPublico | null> {
  "use cache";
  cacheLife("minutes");
  cacheTag(`local-${slug}`);

  const { data, error } = await getSupabase().rpc("fn_local_publico", { p_slug: slug });
  if (error) throw traducirErrorReservas(error);
  return data ? aLocal(data) : null;
}
