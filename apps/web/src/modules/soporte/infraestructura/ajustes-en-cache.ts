// WhatsApp de ayuda guardado en la caché de Next.js ("use cache"): lo pide el
// botón "Ayuda" de TODAS las páginas, así que no se consulta la base en cada
// visita. Al guardarlo en /admin se borra la etiqueta y se ve al instante.

import { cacheLife, cacheTag } from "next/cache";
import { getSupabase } from "@/modules/compartido/infraestructura/supabase/cliente-publico";
import type { AjustesPublicos } from "../dominio/soporte";
import { SupabaseAjustesRepositorio } from "./supabase-ajustes.repositorio";

export const ETIQUETA_AJUSTES = "ajustes-publicos";

/** Si falla (sin Supabase o sin la migración 012) lanza el error: no se guarda en caché */
export async function leerAjustesEnCache(): Promise<AjustesPublicos> {
  "use cache";
  cacheLife("hours");
  cacheTag(ETIQUETA_AJUSTES);
  return new SupabaseAjustesRepositorio(getSupabase()).leerPublicos();
}
