// PATCH /api/dueno/reservas/<id>
//      cuerpo: { accion: "cobrar" | "jugo" | "no_vino" | "cancelar", monto?, motivo? }
// Cobrar registra un pago en efectivo; Cancelar pide motivo (lo ve el jugador).

import { NextResponse } from "next/server";
import { gestionarReserva } from "@/modules/agenda/aplicacion/agenda.casos-de-uso";
import { agendaConSesion } from "@/modules/agenda/infraestructura/composicion";
import { crearClienteServidor } from "@/modules/compartido/infraestructura/supabase/cliente-servidor";
import { respuestaError, SIN_CACHE_PRIVADO } from "@/modules/compartido/presentacion/http";

type Contexto = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Contexto) {
  try {
    const { id } = await params;
    const datos = await request.json().catch(() => null);
    const reserva = await gestionarReserva(agendaConSesion(await crearClienteServidor()), id, datos);
    return NextResponse.json({ ok: true, reserva }, { headers: SIN_CACHE_PRIVADO });
  } catch (e) {
    return respuestaError(e);
  }
}
