// POST /api/pagos/<id>/revisar  { "accion": "confirmar" | "rechazar", "motivo"?: string }
// Solo el dueño del local o el admin (lo verifica la base con fn_revisar_pago).

import { NextResponse } from "next/server";
import { crearClienteServidor } from "@/lib/auth/servidor";
import { aErrorCatalogo } from "@/lib/catalogo-servidor";
import { revisarPago } from "@/lib/pagos/pagos-servidor";

type Contexto = { params: Promise<{ id: string }> };
const SIN_CACHE = { "Cache-Control": "private, no-store" };

export async function POST(request: Request, { params }: Contexto) {
  try {
    const { id } = await params;
    const cuerpo = (await request.json().catch(() => ({}))) as { accion?: string; motivo?: unknown };
    if (cuerpo.accion !== "confirmar" && cuerpo.accion !== "rechazar") {
      return NextResponse.json({ ok: false, error: "Acción no válida.", codigo: "DATOS_INVALIDOS" }, { status: 400 });
    }
    const motivo = typeof cuerpo.motivo === "string" ? cuerpo.motivo : undefined;
    const r = await revisarPago(await crearClienteServidor(), id, cuerpo.accion === "confirmar", motivo);
    return NextResponse.json({ ok: true, ...r }, { headers: SIN_CACHE });
  } catch (e) {
    const err = aErrorCatalogo(e);
    return NextResponse.json({ ok: false, error: err.message, codigo: err.codigo }, { status: err.status, headers: SIN_CACHE });
  }
}
