// PUT    /api/canchas/:id  -> corrige una cancha que sigue en revisión (devuelve un id nuevo)
// DELETE /api/canchas/:id  -> quita una cancha que sigue en revisión
// Solo su dueño o el admin. Las canchas ya aprobadas no se cambian desde aquí.

import { NextResponse } from "next/server";
import { corregirCancha, quitarCancha } from "@/modules/catalogo/aplicacion/catalogo.casos-de-uso";
import { catalogoConSesion } from "@/modules/catalogo/infraestructura/composicion";
import { crearClienteServidor } from "@/modules/compartido/infraestructura/supabase/cliente-servidor";
import { respuestaError, SIN_CACHE } from "@/modules/compartido/presentacion/http";

type Contexto = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: Contexto) {
  try {
    const { id } = await params;
    const cuerpo = await request.json().catch(() => null);
    const r = await corregirCancha(catalogoConSesion(await crearClienteServidor()), id, cuerpo);
    return NextResponse.json({ ok: true, ...r }, { headers: SIN_CACHE });
  } catch (e) {
    return respuestaError(e, SIN_CACHE);
  }
}

export async function DELETE(_request: Request, { params }: Contexto) {
  try {
    const { id } = await params;
    await quitarCancha(catalogoConSesion(await crearClienteServidor()), id);
    return NextResponse.json({ ok: true }, { headers: SIN_CACHE });
  } catch (e) {
    return respuestaError(e, SIN_CACHE);
  }
}
