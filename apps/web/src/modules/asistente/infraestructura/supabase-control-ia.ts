// Cupo diario, configuración del modelo y registro de llamadas del asistente,
// con la sesión de quien pregunta (013_asistente_ia.sql). Capa: infraestructura.

import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { aConfigIA, type RegistroIA } from "@/modules/compartido/dominio/ia";
import type { ControlIA, Cupo } from "../dominio/asistente.puertos";

const MOTIVOS = ["SIN_SESION", "CUPO_CUENTA", "CUPO_DIA"] as const;

export const aCupo = (d: unknown): Cupo => {
  const o = (d && typeof d === "object" ? d : {}) as Record<string, unknown>;
  return {
    permitido: o.permitido === true,
    motivo: MOTIVOS.find((m) => m === o.motivo) ?? null,
    limiteCuenta: Number(o.limite_cuenta ?? 0),
  };
};

export class SupabaseControlIA implements ControlIA {
  constructor(private readonly db: SupabaseClient) {}

  async cupo() {
    const { data, error } = await this.db.rpc("fn_cupo_asistente");
    if (error) throw new Error(error.message);
    return aCupo(data);
  }

  async config() {
    const { data, error } = await this.db.rpc("fn_config_ia", { p_funcion: "chat_assistant" });
    return error ? null : aConfigIA(data);
  }

  async registrar(ia: RegistroIA) {
    const { error } = await this.db.rpc("fn_registrar_ia_asistente", { p_ia: ia });
    if (error) throw new Error(error.message);
  }
}

export type UsoIAHoy = { asistente: number; asistenteFallidos: number; comprobantes: number; limiteAsistente: number; limiteOpenRouter: number };

/** Uso de la IA de hoy (día UTC, como cuenta OpenRouter). Solo admin. */
export async function leerUsoIAHoy(db: SupabaseClient): Promise<UsoIAHoy | null> {
  const { data, error } = await db.rpc("fn_uso_ia_hoy");
  if (error || !data) return null;
  const n = (v: unknown) => Number(v ?? 0);
  return {
    asistente: n(data.asistente),
    asistenteFallidos: n(data.asistente_fallidos),
    comprobantes: n(data.comprobantes),
    limiteAsistente: n(data.limite_asistente),
    limiteOpenRouter: n(data.limite_openrouter),
  };
}
