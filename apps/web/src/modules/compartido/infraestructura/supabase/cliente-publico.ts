import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Datos del proyecto: Supabase → Project Settings → API Keys.
// La clave "publishable" (sb_publishable_...) reemplaza a la antigua "anon" (eyJ...).
// Se acepta cualquiera de las dos. Ambas son públicas: lo que protege los datos es RLS.
// Nunca pongas aquí la clave "secret" ni "service_role".
export const URL_SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL;
export const CLAVE_PUBLICA = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let cliente: SupabaseClient | null = null;

// Cliente SIN sesión, para leer el catálogo público (se puede cachear).
// Para lo que depende de quién inició sesión usa cliente-servidor.ts.
export function getSupabase(): SupabaseClient {
  if (!URL_SUPABASE || !CLAVE_PUBLICA) {
    throw new Error("FALTA_CONFIGURAR_SUPABASE");
  }
  if (!cliente) {
    cliente = createClient(URL_SUPABASE, CLAVE_PUBLICA, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return cliente;
}
