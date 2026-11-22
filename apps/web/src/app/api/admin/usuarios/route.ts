// GET /api/admin/usuarios?buscar=<texto>&filtro=todos|jugadores|duenos|admins|suspendidos
//   -> hasta 100 cuentas, las más recientes primero (solo admin, lo verifica la base)

import { connection, NextResponse } from "next/server";
import { verUsuarios } from "@/modules/usuarios/aplicacion/usuarios.casos-de-uso";
import { usuariosConSesion } from "@/modules/usuarios/infraestructura/composicion";
import { crearClienteServidor } from "@/modules/compartido/infraestructura/supabase/cliente-servidor";
import { respuestaError, SIN_CACHE_PRIVADO } from "@/modules/compartido/presentacion/http";

export async function GET(request: Request) {
  await connection(); // depende de la sesión: siempre en el momento del pedido
  try {
    const sp = new URL(request.url).searchParams;
    const usuarios = await verUsuarios(usuariosConSesion(await crearClienteServidor()), sp.get("buscar"), sp.get("filtro"));
    return NextResponse.json({ ok: true, usuarios }, { headers: SIN_CACHE_PRIVADO });
  } catch (e) {
    return respuestaError(e);
  }
}
