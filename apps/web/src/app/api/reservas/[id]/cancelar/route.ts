// POST /api/reservas/<id>/cancelar  -> cancela una reserva propia
//      cuerpo opcional: { motivo }

import { NextResponse } from "next/server";
import { crearClienteServidor } from "@/lib/auth/servidor";
import { aErrorCatalogo } from "@/lib/catalogo-servidor";
import { cancelarReserva } from "@/lib/reservas-servidor";

type Contexto = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Contexto) {
  try {
    const { id } = await params;
    const cuerpo = (await request.json().catch(() => null)) as { motivo?: unknown } | null;
    const motivo = typeof cuerpo?.motivo === "string" ? cuerpo.motivo : undefined;
    const r = await cancelarReserva(await crearClienteServidor(), id, motivo);
    return NextResponse.json({ ok: true, ...r }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) {
    const err = aErrorCatalogo(e);
    return NextResponse.json(
      { ok: false, error: err.message, codigo: err.codigo },
      { status: err.status, headers: { "Cache-Control": "private, no-store" } },
    );
  }
}
