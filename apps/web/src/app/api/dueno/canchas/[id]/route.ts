// PUT    /api/dueno/canchas/<id>  -> guardar nombre, deporte, horario por día y precios
//        cuerpo: { nombre, deporte, techada, maxMinutos, horario: [{ dia, abre, cierra }],
//                  precio, precioPunta?, puntaDesde? }
// DELETE /api/dueno/canchas/<id>  -> dejar de ofrecer la cancha (si no tiene reservas pendientes)

import { NextResponse } from "next/server";
import { guardarCanchaDelLocal, quitarCanchaDelLocal } from "@/modules/locales/aplicacion/locales.casos-de-uso";
import { localesConSesion } from "@/modules/locales/infraestructura/composicion";
import { crearClienteServidor } from "@/modules/compartido/infraestructura/supabase/cliente-servidor";
import { respuestaError, SIN_CACHE_PRIVADO } from "@/modules/compartido/presentacion/http";

type Contexto = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: Contexto) {
  try {
    const { id } = await params;
    const datos = await request.json().catch(() => null);
    const cancha = await guardarCanchaDelLocal(localesConSesion(await crearClienteServidor()), id, datos);
    return NextResponse.json({ ok: true, cancha }, { headers: SIN_CACHE_PRIVADO });
  } catch (e) {
    return respuestaError(e);
  }
}

export async function DELETE(_request: Request, { params }: Contexto) {
  try {
    const { id } = await params;
    await quitarCanchaDelLocal(localesConSesion(await crearClienteServidor()), id);
    return NextResponse.json({ ok: true }, { headers: SIN_CACHE_PRIVADO });
  } catch (e) {
    return respuestaError(e);
  }
}
