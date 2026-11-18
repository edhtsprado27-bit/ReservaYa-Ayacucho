// Cliente de Supabase CON la sesión de quien navega (lee las cookies).
// Úsalo en páginas del servidor, rutas /api y acciones del servidor.

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { CLAVE_PUBLICA, URL_SUPABASE } from "@/lib/supabase";

export async function crearClienteServidor() {
  if (!URL_SUPABASE || !CLAVE_PUBLICA) throw new Error("FALTA_CONFIGURAR_SUPABASE");
  const cookieStore = await cookies();

  return createServerClient(URL_SUPABASE, CLAVE_PUBLICA, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Llamado desde un componente del servidor: no puede escribir cookies.
          // No pasa nada: src/proxy.ts renueva la sesión en cada visita.
        }
      },
    },
  });
}
