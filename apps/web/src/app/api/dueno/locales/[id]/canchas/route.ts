// POST /api/dueno/locales/<id>/canchas  -> agregar una cancha al local
//      cuerpo: { nombre, deporte: "futbol" | "futsal" | "voley", precio }
// Empieza con horario de 08:00 a 23:00 todos los días; luego se ajusta con PUT /api/dueno/canchas/<id>.

import { NextResponse } from "next/server";
import { agregarCanchaAlLocal } from "@/modules/locales/aplicacion/locales.casos-de-uso";
import { localesConSesion } from "@/modules/locales/infraestructura/composicion";
import { crearClienteServidor } from "@/modules/compartido/infraestructura/supabase/cliente-servidor";
import { respuestaError, SIN_CACHE_PRIVADO } from "@/modules/compartido/presentacion/http";

type Contexto = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Contexto) {
  try {
    const { id } = await params;
    const datos = await request.json().catch(() => null);
    const cancha = await agregarCanchaAlLocal(localesConSesion(await crearClienteServidor()), id, datos);
    return NextResponse.json({ ok: true, cancha }, { status: 201, headers: SIN_CACHE_PRIVADO });
  } catch (e) {
    return respuestaError(e);
  }
}
