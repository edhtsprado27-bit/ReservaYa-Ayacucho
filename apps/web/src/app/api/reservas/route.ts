// GET  /api/reservas -> mis reservas (próximas primero)
// POST /api/reservas -> aparta un horario mientras se paga el adelanto
//      cuerpo: { canchaId, inicio, fin, clave }   (clave: un id único por intento)

import { NextResponse } from "next/server";
import { crearClienteServidor } from "@/lib/auth/servidor";
import { aErrorCatalogo } from "@/lib/catalogo-servidor";
import { misReservas, reservar, validarPedido } from "@/lib/reservas-servidor";

const SIN_CACHE = { "Cache-Control": "private, no-store" };

function respuestaError(e: unknown) {
  const err = aErrorCatalogo(e);
  return NextResponse.json({ ok: false, error: err.message, codigo: err.codigo }, { status: err.status, headers: SIN_CACHE });
}

export async function GET() {
  try {
    // Sin pedir el usuario a Supabase Auth (un viaje menos): la base de datos
    // lee la sesión del token y solo devuelve las reservas de quien llama.
    const reservas = await misReservas(await crearClienteServidor());
    return NextResponse.json({ ok: true, reservas }, { headers: SIN_CACHE });
  } catch (e) {
    const err = aErrorCatalogo(e);
    // Sin sesión no hay reservas que mostrar
    if (err.codigo === "SIN_SESION") return NextResponse.json({ ok: true, reservas: [] }, { headers: SIN_CACHE });
    return respuestaError(err);
  }
}

export async function POST(request: Request) {
  try {
    const pedido = validarPedido(await request.json().catch(() => null));
    const reserva = await reservar(await crearClienteServidor(), pedido);
    return NextResponse.json({ ok: true, reserva }, { status: 201, headers: SIN_CACHE });
  } catch (e) {
    return respuestaError(e);
  }
}
