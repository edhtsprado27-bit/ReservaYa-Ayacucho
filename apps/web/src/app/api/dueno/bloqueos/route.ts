// POST /api/dueno/bloqueos  -> cerrar horas de una cancha (mantenimiento, torneo, evento)
//      cuerpo: { canchaId, inicio, fin, motivo? }
// Los jugadores ven esas horas como "Cerrada". No se puede bloquear encima de reservas.

import { NextResponse } from "next/server";
import { bloquearHorario } from "@/modules/agenda/aplicacion/agenda.casos-de-uso";
import { agendaConSesion } from "@/modules/agenda/infraestructura/composicion";
import { crearClienteServidor } from "@/modules/compartido/infraestructura/supabase/cliente-servidor";
import { respuestaError, SIN_CACHE_PRIVADO } from "@/modules/compartido/presentacion/http";

export async function POST(request: Request) {
  try {
    const datos = await request.json().catch(() => null);
    const bloqueo = await bloquearHorario(agendaConSesion(await crearClienteServidor()), datos);
    return NextResponse.json({ ok: true, bloqueo }, { status: 201, headers: SIN_CACHE_PRIVADO });
  } catch (e) {
    return respuestaError(e);
  }
}
