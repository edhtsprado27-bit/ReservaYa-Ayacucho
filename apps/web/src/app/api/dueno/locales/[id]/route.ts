// GET /api/dueno/locales/<id>  -> reglas de reserva, canchas, horario y precios del local
// PUT /api/dueno/locales/<id>  -> guardar reglas de reserva y contacto
//      cuerpo: { direccion, referencia?, whatsapp?, adelantoPct, minutosApartado, horasCancelacion }
// Solo el dueño del local o el admin (lo verifica la base). Nunca se guarda en caché.

import { NextResponse } from "next/server";
import { guardarAjustesLocal, verConfiguracion } from "@/modules/locales/aplicacion/locales.casos-de-uso";
import { localesConSesion } from "@/modules/locales/infraestructura/composicion";
import { crearClienteServidor } from "@/modules/compartido/infraestructura/supabase/cliente-servidor";
import { respuestaError, SIN_CACHE_PRIVADO } from "@/modules/compartido/presentacion/http";

type Contexto = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Contexto) {
  try {
    const { id } = await params;
    const config = await verConfiguracion(localesConSesion(await crearClienteServidor()), id);
    return NextResponse.json({ ok: true, config }, { headers: SIN_CACHE_PRIVADO });
  } catch (e) {
    return respuestaError(e);
  }
}

export async function PUT(request: Request, { params }: Contexto) {
  try {
    const { id } = await params;
    const datos = await request.json().catch(() => null);
    const local = await guardarAjustesLocal(localesConSesion(await crearClienteServidor()), id, datos);
    return NextResponse.json({ ok: true, local }, { headers: SIN_CACHE_PRIVADO });
  } catch (e) {
    return respuestaError(e);
  }
}
