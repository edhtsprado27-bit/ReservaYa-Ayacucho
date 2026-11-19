// PUT /api/locales/<id>/pago  { "yape"?: "966123456", "plin"?: "...", "titular"?: "Juan Pérez" }
// Datos para que los jugadores paguen el adelanto. Solo el dueño del local o el admin.

import { NextResponse } from "next/server";
import { crearClienteServidor } from "@/modules/compartido/infraestructura/supabase/cliente-servidor";
import { respuestaError, SIN_CACHE_PRIVADO } from "@/modules/compartido/presentacion/http";
import { guardarDatosPago } from "@/modules/pagos/aplicacion/pagos.casos-de-uso";
import { pagosConSesion } from "@/modules/pagos/infraestructura/composicion";

type Contexto = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: Contexto) {
  try {
    const { id } = await params;
    const cuerpo = (await request.json().catch(() => ({}))) as { yape?: unknown; plin?: unknown; titular?: unknown };
    const { pagos } = pagosConSesion(await crearClienteServidor());
    const datos = await guardarDatosPago(pagos, id, cuerpo);
    return NextResponse.json({ ok: true, datos }, { headers: SIN_CACHE_PRIVADO });
  } catch (e) {
    return respuestaError(e);
  }
}
