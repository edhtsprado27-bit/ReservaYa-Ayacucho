// Renueva la sesión de Supabase en cada visita (lo llama src/proxy.ts).
// Patrón oficial de @supabase/ssr para Next.js 16.

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { CLAVE_PUBLICA, URL_SUPABASE } from "./cliente-publico";

export async function actualizarSesion(request: NextRequest) {
  let respuesta = NextResponse.next({ request });
  if (!URL_SUPABASE || !CLAVE_PUBLICA) return { respuesta, hayUsuario: false };

  const supabase = createServerClient(URL_SUPABASE, CLAVE_PUBLICA, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        respuesta = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => respuesta.cookies.set(name, value, options));
        Object.entries(headers ?? {}).forEach(([k, v]) => respuesta.headers.set(k, v));
      },
    },
  });

  // No pongas código entre createServerClient y getUser(): Supabase lo pide
  // para evitar sesiones que se cierran solas.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { respuesta, hayUsuario: Boolean(user) };
}
