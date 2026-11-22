// PUT /api/admin/ajustes  { "whatsappSoporte": "966123456" }   ("" o null = quitar el botón)
// WhatsApp de ayuda de la plataforma (RF15). Solo el administrador. Al guardar,
// el botón "Ayuda por WhatsApp" de todas las páginas se actualiza al instante.

import { NextResponse } from "next/server";
import { guardarAjustesPlataforma } from "@/modules/soporte/aplicacion/soporte.casos-de-uso";
import { ajustesConSesion } from "@/modules/soporte/infraestructura/composicion";
import { crearClienteServidor } from "@/modules/compartido/infraestructura/supabase/cliente-servidor";
import { respuestaError, SIN_CACHE_PRIVADO } from "@/modules/compartido/presentacion/http";

export async function PUT(request: Request) {
  try {
    const datos = await request.json().catch(() => null);
    const ajustes = await guardarAjustesPlataforma(ajustesConSesion(await crearClienteServidor()), datos);
    return NextResponse.json({ ok: true, ajustes }, { headers: SIN_CACHE_PRIVADO });
  } catch (e) {
    return respuestaError(e);
  }
}
