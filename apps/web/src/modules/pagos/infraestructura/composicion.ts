// Raíz de composición de pagos: une los puertos con sus implementaciones
// (Supabase para la base y el almacén, OpenRouter para la IA).

import "server-only";
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { DependenciasPago } from "../aplicacion/enviar-comprobante";
import { OpenRouterLectorComprobantes } from "./openrouter-lector";
import { SupabaseAlmacenComprobantes } from "./supabase-almacen-comprobantes";
import { SupabasePagosRepositorio } from "./supabase-pagos.repositorio";

const sha256 = (imagen: Uint8Array) => createHash("sha256").update(imagen).digest("hex");

/** Todo lo que necesitan los casos de uso de pagos, con la sesión de quien pide */
export function pagosConSesion(db: SupabaseClient): DependenciasPago {
  return {
    pagos: new SupabasePagosRepositorio(db),
    almacen: new SupabaseAlmacenComprobantes(db),
    lector: new OpenRouterLectorComprobantes(),
    huella: sha256,
  };
}
