// POST /api/reservas/<id>/pago  (multipart/form-data)
//      campos: imagen (captura de Yape/Plin, máx. 3 MB) y metodo ("yape" | "plin")
// Sube la captura al bucket privado, la IA la lee y la reserva pasa a "Pago en revisión".

import { NextResponse } from "next/server";
import { crearClienteServidor } from "@/lib/auth/servidor";
import { aErrorCatalogo, ErrorCatalogo } from "@/lib/catalogo-servidor";
import { enviarComprobante, MAX_BYTES } from "@/lib/pagos/pagos-servidor";

// La lectura con IA puede tardar unos segundos
export const maxDuration = 60;

type Contexto = { params: Promise<{ id: string }> };
const SIN_CACHE = { "Cache-Control": "private, no-store" };

export async function POST(request: Request, { params }: Contexto) {
  try {
    const { id } = await params;
    const largo = Number(request.headers.get("content-length") ?? 0);
    if (largo > MAX_BYTES + 100_000) {
      throw new ErrorCatalogo("IMAGEN_GRANDE", 413, "La imagen pesa más de 3 MB. Toma la captura otra vez.");
    }
    const form = await request.formData().catch(() => null);
    const archivo = form?.get("imagen");
    const metodo = form?.get("metodo");
    if (!(archivo instanceof Blob) || (metodo !== "yape" && metodo !== "plin")) {
      throw new ErrorCatalogo("DATOS_INVALIDOS_PAGO", 400, "Elige Yape o Plin y adjunta la captura del pago.");
    }
    const imagen = Buffer.from(await archivo.arrayBuffer());
    const r = await enviarComprobante(await crearClienteServidor(), id, metodo, imagen);
    return NextResponse.json({ ok: true, ...r }, { status: 201, headers: SIN_CACHE });
  } catch (e) {
    const err = aErrorCatalogo(e);
    return NextResponse.json({ ok: false, error: err.message, codigo: err.codigo }, { status: err.status, headers: SIN_CACHE });
  }
}
