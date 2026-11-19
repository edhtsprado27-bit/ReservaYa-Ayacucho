// POST /api/reservas/<id>/cancelar  -> cancela una reserva propia
//      cuerpo opcional: { motivo }

import { NextResponse } from "next/server";
import { crearClienteServidor } from "@/modules/compartido/infraestructura/supabase/cliente-servidor";
import { respuestaError, SIN_CACHE_PRIVADO } from "@/modules/compartido/presentacion/http";
import { cancelarReserva } from "@/modules/reservas/aplicacion/reservas.casos-de-uso";
import { reservasConSesion } from "@/modules/reservas/infraestructura/composicion";

type Contexto = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Contexto) {
  try {
    const { id } = await params;
    const cuerpo = (await request.json().catch(() => null)) as { motivo?: unknown } | null;
    const motivo = typeof cuerpo?.motivo === "string" ? cuerpo.motivo : undefined;
    const r = await cancelarReserva(reservasConSesion(await crearClienteServidor()), id, motivo);
    return NextResponse.json({ ok: true, ...r }, { headers: SIN_CACHE_PRIVADO });
  } catch (e) {
    return respuestaError(e);
  }
}
