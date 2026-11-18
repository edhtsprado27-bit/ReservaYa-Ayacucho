// Se ejecuta antes de cada página (en Next.js 16 reemplaza a middleware.ts).
//  1. Renueva la sesión de Supabase.
//  2. Si alguien sin sesión abre una página privada, lo manda al login
//     y después lo regresa a donde quería ir.

import { NextResponse, type NextRequest } from "next/server";
import { actualizarSesion } from "@/lib/auth/proxy";

const PRIVADAS = ["/mi-cuenta", "/dueno", "/admin", "/nueva-clave"];

export async function proxy(request: NextRequest) {
  const { respuesta, hayUsuario } = await actualizarSesion(request);
  const ruta = request.nextUrl.pathname;

  if (!hayUsuario && PRIVADAS.some((p) => ruta === p || ruta.startsWith(p + "/"))) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(ruta)}`;
    const redireccion = NextResponse.redirect(url);
    respuesta.cookies.getAll().forEach((c) => redireccion.cookies.set(c));
    return redireccion;
  }
  return respuesta;
}

export const config = {
  matcher: [
    // Todo menos archivos estáticos, imágenes y el catálogo público (/api/canchas),
    // que no depende de la sesión y así responde más rápido.
    "/((?!_next/static|_next/image|favicon.ico|api/canchas$|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
