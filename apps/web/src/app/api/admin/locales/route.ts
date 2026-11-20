// GET /api/admin/locales  -> locales publicados y suspendidos con su dueño (solo admin)

import { connection, NextResponse } from "next/server";
import { verLocalesAdmin } from "@/modules/locales/aplicacion/locales.casos-de-uso";
import { localesConSesion } from "@/modules/locales/infraestructura/composicion";
import { crearClienteServidor } from "@/modules/compartido/infraestructura/supabase/cliente-servidor";
import { respuestaError, SIN_CACHE_PRIVADO } from "@/modules/compartido/presentacion/http";

export async function GET() {
  await connection(); // depende de la sesión: siempre en el momento del pedido
  try {
    const locales = await verLocalesAdmin(localesConSesion(await crearClienteServidor()));
    return NextResponse.json({ ok: true, locales }, { headers: SIN_CACHE_PRIVADO });
  } catch (e) {
    return respuestaError(e);
  }
}
