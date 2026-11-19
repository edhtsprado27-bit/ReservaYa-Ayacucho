// POST /api/admin/locales/:id  { "accion": "aprobar" | "rechazar", "motivo"?: string }
// Solo el administrador (lo verifica la base de datos con fn_revisar_local).

import { NextResponse } from "next/server";
import { revisarCancha } from "@/modules/catalogo/aplicacion/catalogo.casos-de-uso";
import { catalogoConSesion } from "@/modules/catalogo/infraestructura/composicion";
import { crearClienteServidor } from "@/modules/compartido/infraestructura/supabase/cliente-servidor";
import { respuestaError, SIN_CACHE } from "@/modules/compartido/presentacion/http";

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
