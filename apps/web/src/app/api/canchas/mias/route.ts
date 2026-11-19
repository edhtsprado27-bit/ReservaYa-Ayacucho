// GET /api/canchas/mias -> canchas en revisión que puedes ver y editar
// (dueño: las suyas; admin: todas). Sin sesión: lista vacía.

import { connection, NextResponse } from "next/server";
import { verPendientes } from "@/modules/catalogo/aplicacion/catalogo.casos-de-uso";
import { catalogoConSesion } from "@/modules/catalogo/infraestructura/composicion";
import { crearClienteServidor } from "@/modules/compartido/infraestructura/supabase/cliente-servidor";
import { respuestaError, SIN_CACHE_PRIVADO } from "@/modules/compartido/presentacion/http";

export async function GET() {
  await connection(); // depende de la sesión: nunca se guarda en caché
  try {
    const db = await crearClienteServidor();
    const {
      data: { user },
    } = await db.auth.getUser();
    if (!user) return NextResponse.json({ canchas: [] }, { headers: SIN_CACHE_PRIVADO });
    const canchas = await verPendientes(catalogoConSesion(db));
    return NextResponse.json({ canchas }, { headers: SIN_CACHE_PRIVADO });
  } catch (e) {
    return respuestaError(e, SIN_CACHE_PRIVADO, false);
  }
}
