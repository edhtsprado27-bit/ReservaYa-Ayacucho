// POST  /api/admin/locales/:id  { "accion": "aprobar" | "rechazar", "motivo"?: string }
// PATCH /api/admin/locales/:id  { "accion": "asignar_dueno", "correo" }
//                               { "accion": "suspender", "motivo" } | { "accion": "reactivar" }
// Solo el administrador (lo verifica la base de datos).

import { NextResponse } from "next/server";
import { revisarCancha } from "@/modules/catalogo/aplicacion/catalogo.casos-de-uso";
import { gestionarLocal } from "@/modules/locales/aplicacion/locales.casos-de-uso";
import { localesConSesion } from "@/modules/locales/infraestructura/composicion";
import { catalogoConSesion } from "@/modules/catalogo/infraestructura/composicion";
import { crearClienteServidor } from "@/modules/compartido/infraestructura/supabase/cliente-servidor";
import { respuestaError, SIN_CACHE, SIN_CACHE_PRIVADO } from "@/modules/compartido/presentacion/http";

type Contexto = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Contexto) {
  try {
    const { id } = await params;
    const cuerpo = (await request.json().catch(() => ({}))) as { accion?: string; motivo?: string };
    if (cuerpo.accion !== "aprobar" && cuerpo.accion !== "rechazar") {
      return NextResponse.json({ ok: false, error: "Acción no válida.", codigo: "DATOS_INVALIDOS" }, { status: 400 });
    }
    const r = await revisarCancha(catalogoConSesion(await crearClienteServidor()), id, cuerpo.accion === "aprobar", cuerpo.motivo);
    return NextResponse.json({ ok: true, ...r }, { headers: SIN_CACHE });
  } catch (e) {
    return respuestaError(e, SIN_CACHE);
  }
}

export async function PATCH(request: Request, { params }: Contexto) {
  try {
    const { id } = await params;
    const datos = await request.json().catch(() => null);
    const local = await gestionarLocal(localesConSesion(await crearClienteServidor()), id, datos);
    return NextResponse.json({ ok: true, local }, { headers: SIN_CACHE_PRIVADO });
  } catch (e) {
    return respuestaError(e);
  }
}
