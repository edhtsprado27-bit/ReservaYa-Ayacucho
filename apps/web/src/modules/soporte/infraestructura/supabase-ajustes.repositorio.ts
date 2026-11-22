// Ajustes de la plataforma con Supabase (012): fn_ajustes_publicos (cualquiera)
// y fn_guardar_ajustes (solo admin, queda en audit_logs).

import type { SupabaseClient } from "@supabase/supabase-js";
import { traducirErrorSupabase } from "@/modules/compartido/infraestructura/supabase/traducir-error";
import type { AjustesRepositorio } from "../dominio/ajustes.repositorio";
import type { AjustesPublicos } from "../dominio/soporte";

export const aAjustes = (d: unknown): AjustesPublicos => {
  const v = (d as { whatsapp_soporte?: unknown } | null)?.whatsapp_soporte;
  return { whatsappSoporte: typeof v === "string" && v ? v : null };
};

export class SupabaseAjustesRepositorio implements AjustesRepositorio {
  constructor(private readonly db: SupabaseClient) {}

  async leerPublicos() {
    const { data, error } = await this.db.rpc("fn_ajustes_publicos");
    if (error) throw traducirErrorSupabase(error);
    return aAjustes(data);
  }

  async guardar(p: { whatsappSoporte: string | null }) {
    const { data, error } = await this.db.rpc("fn_guardar_ajustes", { p_whatsapp_soporte: p.whatsappSoporte ?? "" });
    if (error) throw traducirErrorSupabase(error);
    return aAjustes(data);
  }
}
