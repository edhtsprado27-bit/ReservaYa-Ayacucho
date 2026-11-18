// Los enlaces que envía Supabase por correo (confirmar cuenta, recuperar
// contraseña) terminan aquí: se canjea el código por una sesión y se
// redirige a la página que corresponde.

import { NextResponse, type NextRequest } from "next/server";
import { destinoSeguro } from "@/lib/auth/destino";
import { crearClienteServidor } from "@/lib/auth/servidor";

export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const code = url.searchParams.get("code");
  const next = destinoSeguro(url.searchParams.get("next"));

  if (code) {
    try {
      const supabase = await crearClienteServidor();
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) return NextResponse.redirect(new URL(next, url.origin));
    } catch {
      // cae al aviso de enlace inválido
    }
  }
  return NextResponse.redirect(new URL("/login?error=enlace", url.origin));
}
