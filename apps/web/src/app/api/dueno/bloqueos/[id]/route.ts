// DELETE /api/dueno/bloqueos/<id>  -> volver a abrir las horas bloqueadas

import { NextResponse } from "next/server";
import { quitarBloqueo } from "@/modules/agenda/aplicacion/agenda.casos-de-uso";
import { agendaConSesion } from "@/modules/agenda/infraestructura/composicion";
import { crearClienteServidor } from "@/modules/compartido/infraestructura/supabase/cliente-servidor";
import { respuestaError, SIN_CACHE_PRIVADO } from "@/modules/compartido/presentacion/http";

type Contexto = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, { params }: Contexto) {
  try {
    const { id } = await params;
    await quitarBloqueo(agendaConSesion(await crearClienteServidor()), id);
    return NextResponse.json({ ok: true }, { headers: SIN_CACHE_PRIVADO });
  } catch (e) {
    return respuestaError(e);
  }
}
