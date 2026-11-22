// Raíz de composición del WhatsApp de ayuda.

import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidateTag } from "next/cache";
import type { AjustesRepositorio } from "../dominio/ajustes.repositorio";
import { SIN_AJUSTES, type AjustesPublicos } from "../dominio/soporte";
import { ETIQUETA_AJUSTES, leerAjustesEnCache } from "./ajustes-en-cache";
import { SupabaseAjustesRepositorio } from "./supabase-ajustes.repositorio";

/** Con la sesión del admin: al guardar, renueva el botón "Ayuda" de toda la web (patrón Decorator) */
export const ajustesConSesion = (db: SupabaseClient): AjustesRepositorio => {
  const repo = new SupabaseAjustesRepositorio(db);
  return {
    leerPublicos: () => repo.leerPublicos(),
    async guardar(p) {
      const r = await repo.guardar(p);
      revalidateTag(ETIQUETA_AJUSTES, { expire: 0 });
      return r;
    },
  };
};

/** Para las páginas: si Supabase falla, la web sigue funcionando sin el botón de ayuda */
export async function ajustesPublicos(): Promise<AjustesPublicos> {
  try {
    return await leerAjustesEnCache();
  } catch {
    return SIN_AJUSTES;
  }
}
