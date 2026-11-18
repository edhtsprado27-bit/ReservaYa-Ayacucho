// GET  /api/canchas  -> canchas publicadas (aprobadas) para el mapa
// POST /api/canchas  -> registra una cancha nueva; queda "en revisión" (solo dueño o admin)

import { connection, NextResponse } from "next/server";
import { crearClienteServidor } from "@/lib/auth/servidor";
import { aErrorCatalogo, leerCatalogo, proponerLocal, validarNuevaCancha } from "@/lib/catalogo-servidor";

export async function GET() {
  await connection(); // se arma en cada pedido; el CDN cachea la respuesta
  try {
    const { canchas, generado } = await leerCatalogo();
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
    const err = aErrorCatalogo(e);
    return NextResponse.json(
      { error: err.message, codigo: err.codigo },
      { status: err.status, headers: { "Cache-Control": "no-store" } },
    );
  }
}

export async function POST(request: Request) {
  try {
    let cuerpo: unknown;
    try {
      cuerpo = await request.json();
    } catch {
      cuerpo = null;
    }
    const nueva = validarNuevaCancha(cuerpo);
    const r = await proponerLocal(await crearClienteServidor(), nueva);
    return NextResponse.json({ ok: true, ...r }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    const err = aErrorCatalogo(e);
    return NextResponse.json(
      { ok: false, error: err.message, codigo: err.codigo },
      { status: err.status, headers: { "Cache-Control": "no-store" } },
    );
  }
}
