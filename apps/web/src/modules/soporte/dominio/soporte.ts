// WhatsApp de ayuda de la plataforma (RF15). El admin escribe el número en
// /admin y aparece en el botón "Ayuda" de todas las páginas.
// Capa: dominio (puro).

import { ErrorAplicacion } from "@/modules/compartido/dominio/error-aplicacion";
import { celularPeruano } from "@/modules/compartido/dominio/whatsapp";

export type AjustesPublicos = {
  /** "+51966123456" o null si el admin todavía no lo configuró */
  whatsappSoporte: string | null;
};

export const SIN_AJUSTES: AjustesPublicos = { whatsappSoporte: null };

/** { "whatsappSoporte": "966 123 456" } -> "966123456"; vacío -> null (quita el botón) */
export function validarAjustes(x: unknown): { whatsappSoporte: string | null } {
  const o = x && typeof x === "object" && !Array.isArray(x) ? (x as Record<string, unknown>) : null;
  const v = o?.whatsappSoporte;
  if (!o || (v !== null && typeof v !== "string")) {
    throw new ErrorAplicacion("DATOS_INVALIDOS_AJUSTES", 400, "Escribe el celular de ayuda o deja el campo vacío.");
  }
  if (v === null || !v.trim()) return { whatsappSoporte: null };
  const celular = celularPeruano(v);
  if (!celular) throw new ErrorAplicacion("TELEFONO_INVALIDO", 400, "El celular debe tener 9 dígitos y empezar con 9.");
  return { whatsappSoporte: celular };
}
