// PUT /api/dueno/locales/<id>/servicios  -> marca los servicios del local
//      cuerpo: { "servicios": ["vestuarios", "duchas", "estacionamiento"] }   ([] = ninguno)
// Solo el dueño del local o el admin (lo verifica la base). Después del cambio
// se renuevan la ficha pública y el catálogo del mapa.

import { NextResponse } from "next/server";
import { guardarServiciosLocal } from "@/modules/locales/aplicacion/locales.casos-de-uso";
import { localesConSesion } from "@/modules/locales/infraestructura/composicion";
import { crearClienteServidor } from "@/modules/compartido/infraestructura/supabase/cliente-servidor";
import { respuestaError, SIN_CACHE_PRIVADO } from "@/modules/compartido/presentacion/http";

type Contexto = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: Contexto) {
  try {
    const { id } = await params;
    const datos = await request.json().catch(() => null);
    const local = await guardarServiciosLocal(localesConSesion(await crearClienteServidor()), id, datos);
    return NextResponse.json({ ok: true, local }, { headers: SIN_CACHE_PRIVADO });
  } catch (e) {
    return respuestaError(e);
  }
}
