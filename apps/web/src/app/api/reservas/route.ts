// GET  /api/reservas -> mis reservas (próximas primero)
// POST /api/reservas -> aparta un horario mientras se paga el adelanto
//      cuerpo: { canchaId, inicio, fin, clave }   (clave: un id único por intento)

import { NextResponse } from "next/server";
import { crearClienteServidor } from "@/modules/compartido/infraestructura/supabase/cliente-servidor";
import { aErrorAplicacion } from "@/modules/compartido/infraestructura/supabase/traducir-error";
import { respuestaError, SIN_CACHE_PRIVADO } from "@/modules/compartido/presentacion/http";
import { reservarHorario, verMisReservas } from "@/modules/reservas/aplicacion/reservas.casos-de-uso";
import { reservasConSesion } from "@/modules/reservas/infraestructura/composicion";

export async function GET() {
  try {
    // Sin pedir el usuario a Supabase Auth (un viaje menos): la base de datos
    // lee la sesión del token y solo devuelve las reservas de quien llama.
    const reservas = await verMisReservas(reservasConSesion(await crearClienteServidor()));
    return NextResponse.json({ ok: true, reservas }, { headers: SIN_CACHE_PRIVADO });
  } catch (e) {
    const err = aErrorAplicacion(e);
    // Sin sesión no hay reservas que mostrar
    if (err.codigo === "SIN_SESION") return NextResponse.json({ ok: true, reservas: [] }, { headers: SIN_CACHE_PRIVADO });
    return respuestaError(err);
  }
}

export async function POST(request: Request) {
  try {
    const cuerpo = await request.json().catch(() => null);
    const reserva = await reservarHorario(reservasConSesion(await crearClienteServidor()), cuerpo);
    return NextResponse.json({ ok: true, reserva }, { status: 201, headers: SIN_CACHE_PRIVADO });
  } catch (e) {
    return respuestaError(e);
  }
}
