// PATCH /api/admin/usuarios/<id>
//   { "accion": "cambiar_rol", "rol": "jugador" | "dueno" }
//   { "accion": "suspender", "motivo": "..." }   (la persona ve el motivo al ingresar)
//   { "accion": "reactivar" }
// Solo el administrador. Las cuentas de administrador no se cambian (USUARIO_ES_ADMIN).

import { NextResponse } from "next/server";
import { gestionarUsuario } from "@/modules/usuarios/aplicacion/usuarios.casos-de-uso";
import { usuariosConSesion } from "@/modules/usuarios/infraestructura/composicion";
import { crearClienteServidor } from "@/modules/compartido/infraestructura/supabase/cliente-servidor";
import { respuestaError, SIN_CACHE_PRIVADO } from "@/modules/compartido/presentacion/http";

type Contexto = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Contexto) {
  try {
    const { id } = await params;
    const datos = await request.json().catch(() => null);
    const usuario = await gestionarUsuario(usuariosConSesion(await crearClienteServidor()), id, datos);
    return NextResponse.json({ ok: true, usuario }, { headers: SIN_CACHE_PRIVADO });
  } catch (e) {
    return respuestaError(e);
  }
}
