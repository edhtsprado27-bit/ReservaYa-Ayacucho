// Almacén de capturas en Supabase Storage (bucket privado "comprobantes").
// Adaptador del puerto AlmacenComprobantes. Las reglas RLS del bucket deciden
// quién sube (el jugador de la reserva) y quién ve (jugador, dueño y admin).

import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AlmacenComprobantes, ResultadoSubida } from "../dominio/pagos.puertos";

export const BUCKET = "comprobantes";

export class SupabaseAlmacenComprobantes implements AlmacenComprobantes {
  constructor(private readonly db: SupabaseClient) {}

  async subir(ruta: string, imagen: Uint8Array, mime: string): Promise<ResultadoSubida> {
    const { error } = await this.db.storage.from(BUCKET).upload(ruta, imagen, { contentType: mime, upsert: false });
    // La misma captura ya subida (mismo nombre = misma huella) no es un error
    if (!error || /exist|duplicate/i.test(error.message)) return { ok: true };
    console.error("[pagos] No se pudo subir la captura:", error.message);
    return { ok: false, motivo: /row-level security|unauthorized|403/i.test(error.message) ? "sin_permiso" : "fallo" };
  }

  async enlacesFirmados(rutas: string[], segundos: number): Promise<Map<string, string>> {
    const { data } = await this.db.storage.from(BUCKET).createSignedUrls(rutas, segundos);
    const enlaces = new Map<string, string>();
    for (const f of data ?? []) if (f.path && f.signedUrl) enlaces.set(f.path, f.signedUrl);
    return enlaces;
  }
}
