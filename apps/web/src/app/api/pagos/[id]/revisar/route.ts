// POST /api/pagos/<id>/revisar  { "accion": "confirmar" | "rechazar", "motivo"?: string }
// Solo el dueño del local o el admin (lo verifica la base con fn_revisar_pago).

import { NextResponse } from "next/server";
import { crearClienteServidor } from "@/modules/compartido/infraestructura/supabase/cliente-servidor";
import { respuestaError, SIN_CACHE_PRIVADO } from "@/modules/compartido/presentacion/http";
import { revisarPago } from "@/modules/pagos/aplicacion/pagos.casos-de-uso";
import { pagosConSesion } from "@/modules/pagos/infraestructura/composicion";

type Contexto = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Contexto) {
  try {
    const { id } = await params;
    const cuerpo = (await request.json().catch(() => ({}))) as { accion?: string; motivo?: unknown };
    if (cuerpo.accion !== "confirmar" && cuerpo.accion !== "rechazar") {
      return NextResponse.json({ ok: false, error: "Acción no válida.", codigo: "DATOS_INVALIDOS" }, { status: 400 });
    }
    const motivo = typeof cuerpo.motivo === "string" ? cuerpo.motivo : undefined;
    const { pagos } = pagosConSesion(await crearClienteServidor());
    const r = await revisarPago(pagos, id, cuerpo.accion === "confirmar", motivo);
    return NextResponse.json({ ok: true, ...r }, { headers: SIN_CACHE_PRIVADO });
  } catch (e) {
    return respuestaError(e);
  }
}
