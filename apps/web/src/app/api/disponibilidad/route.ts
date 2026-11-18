// GET /api/disponibilidad?local=<id>&fecha=AAAA-MM-DD
// Grilla de horarios de un local en un día (libre / ocupado / pasado / cerrado).
// Es pública y no usa la sesión, así el CDN la puede guardar unos segundos.
// Si alguien reserva justo ese horario, la base de datos igual lo impide.

import { connection, NextResponse, type NextRequest } from "next/server";
import { aErrorCatalogo } from "@/lib/catalogo-servidor";
import { leerDisponibilidad } from "@/lib/reservas-servidor";

export async function GET(request: NextRequest) {
  await connection();
  const p = request.nextUrl.searchParams;
  try {
    const turnos = await leerDisponibilidad(p.get("local") ?? "", p.get("fecha") ?? "");
    return NextResponse.json(
      { turnos, generado: new Date().toISOString() },
      {
        headers: {
          // 5 s en el CDN (y hasta 15 s viejo mientras se renueva): aguanta
          // muchas visitas a la vez sin cargar la base de datos.
          "Cache-Control": "public, s-maxage=5, stale-while-revalidate=15",
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
