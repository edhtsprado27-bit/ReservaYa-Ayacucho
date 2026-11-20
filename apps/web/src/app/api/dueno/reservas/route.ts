// POST /api/dueno/reservas  -> el dueño anota una reserva hecha por teléfono o en persona
//      cuerpo: { canchaId, inicio, fin, nombre, telefono?, pagado?, nota? }
// Queda confirmada. La base impide que choque con otra reserva o con un bloqueo.

import { NextResponse } from "next/server";
import { anotarReserva } from "@/modules/agenda/aplicacion/agenda.casos-de-uso";
import { agendaConSesion } from "@/modules/agenda/infraestructura/composicion";
import { crearClienteServidor } from "@/modules/compartido/infraestructura/supabase/cliente-servidor";
import { respuestaError, SIN_CACHE_PRIVADO } from "@/modules/compartido/presentacion/http";

export async function POST(request: Request) {
  try {
    const datos = await request.json().catch(() => null);
    const reserva = await anotarReserva(agendaConSesion(await crearClienteServidor()), datos);
    return NextResponse.json({ ok: true, reserva }, { status: 201, headers: SIN_CACHE_PRIVADO });
  } catch (e) {
    return respuestaError(e);
  }
}
