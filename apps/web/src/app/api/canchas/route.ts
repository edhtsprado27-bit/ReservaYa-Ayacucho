// GET  /api/canchas  -> canchas publicadas (aprobadas) para el mapa
// POST /api/canchas  -> registra una cancha nueva; queda "en revisión" (solo dueño o admin)
// Capa: presentación. Traduce HTTP <-> casos de uso del módulo catálogo.

import { connection, NextResponse } from "next/server";
import { registrarCancha, verCatalogo } from "@/modules/catalogo/aplicacion/catalogo.casos-de-uso";
import { catalogoConSesion, catalogoPublico } from "@/modules/catalogo/infraestructura/composicion";
import { crearClienteServidor } from "@/modules/compartido/infraestructura/supabase/cliente-servidor";
import { respuestaError, SIN_CACHE } from "@/modules/compartido/presentacion/http";

export async function GET() {
  await connection(); // se arma en cada pedido; el CDN cachea la respuesta
  try {
    const { canchas, generado } = await verCatalogo(catalogoPublico());
    return NextResponse.json(
      { canchas, total: canchas.length, generado },
      {
        headers: {
          // El CDN guarda la respuesta 60 s y la sirve vieja hasta 5 min mientras la renueva.
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
        },
      },
    );
  } catch (e) {
    return respuestaError(e, SIN_CACHE, false);
  }
}

export async function POST(request: Request) {
  try {
    const cuerpo = await request.json().catch(() => null);
    const r = await registrarCancha(catalogoConSesion(await crearClienteServidor()), cuerpo);
    return NextResponse.json({ ok: true, ...r }, { status: 201, headers: SIN_CACHE });
  } catch (e) {
    return respuestaError(e, SIN_CACHE);
  }
}
