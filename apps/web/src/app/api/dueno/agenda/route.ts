// GET /api/dueno/agenda?local=<id>&fecha=AAAA-MM-DD
// Agenda de un día: canchas, turnos, reservas (con nombre y celular) y bloqueos.
// Solo el dueño del local o el admin (lo verifica la base). Nunca se guarda en caché.

import { connection, NextResponse, type NextRequest } from "next/server";
import { verAgenda } from "@/modules/agenda/aplicacion/agenda.casos-de-uso";
import { agendaConSesion } from "@/modules/agenda/infraestructura/composicion";
import { crearClienteServidor } from "@/modules/compartido/infraestructura/supabase/cliente-servidor";
import { respuestaError, SIN_CACHE_PRIVADO } from "@/modules/compartido/presentacion/http";

export async function GET(request: NextRequest) {
  await connection(); // siempre en el momento del pedido (nunca se arma al compilar)
  const p = request.nextUrl.searchParams;
  try {
    const agenda = await verAgenda(agendaConSesion(await crearClienteServidor()), p.get("local") ?? "", p.get("fecha") ?? "");
    return NextResponse.json({ ok: true, agenda }, { headers: SIN_CACHE_PRIVADO });
  } catch (e) {
    return respuestaError(e);
  }
}
