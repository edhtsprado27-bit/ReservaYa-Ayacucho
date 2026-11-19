// PUT /api/locales/<id>/pago  { "yape"?: "966123456", "plin"?: "...", "titular"?: "Juan Pérez" }
// Datos para que los jugadores paguen el adelanto. Solo el dueño del local o el admin.

import { NextResponse } from "next/server";
import { crearClienteServidor } from "@/lib/auth/servidor";
import { aErrorCatalogo } from "@/lib/catalogo-servidor";
import { guardarDatosPago } from "@/lib/pagos/pagos-servidor";

type Contexto = { params: Promise<{ id: string }> };
const SIN_CACHE = { "Cache-Control": "private, no-store" };

export async function PUT(request: Request, { params }: Contexto) {
  try {
    const { id } = await params;
    const cuerpo = (await request.json().catch(() => ({}))) as { yape?: unknown; plin?: unknown; titular?: unknown };
    const datos = await guardarDatosPago(await crearClienteServidor(), id, cuerpo);
    return NextResponse.json({ ok: true, datos }, { headers: SIN_CACHE });
  } catch (e) {
    const err = aErrorCatalogo(e);
    return NextResponse.json({ ok: false, error: err.message, codigo: err.codigo }, { status: err.status, headers: SIN_CACHE });
  }
}
