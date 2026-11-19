// Cliente de Supabase para el navegador (login, registro, cerrar sesión).
// Guarda la sesión en cookies, así el servidor también sabe quién eres.

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

let cliente: SupabaseClient | null = null;

export function clienteNavegador(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const clave =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !clave) throw new Error("FALTA_CONFIGURAR_SUPABASE");
  if (!cliente) cliente = createBrowserClient(url, clave);
  return cliente;
}
