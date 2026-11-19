// POST /api/reservas/<id>/pago  (multipart/form-data)
//      campos: imagen (captura de Yape/Plin, máx. 3 MB) y metodo ("yape" | "plin")
// Sube la captura al bucket privado, la IA la lee y la reserva pasa a "Pago en revisión".

import { NextResponse } from "next/server";
import { ErrorAplicacion } from "@/modules/compartido/dominio/error-aplicacion";
import { crearClienteServidor } from "@/modules/compartido/infraestructura/supabase/cliente-servidor";
import { respuestaError, SIN_CACHE_PRIVADO } from "@/modules/compartido/presentacion/http";
import { enviarComprobante } from "@/modules/pagos/aplicacion/enviar-comprobante";
import { MAX_BYTES } from "@/modules/pagos/dominio/imagen";
import { pagosConSesion } from "@/modules/pagos/infraestructura/composicion";

// La lectura con IA puede tardar unos segundos
export const maxDuration = 60;

type Contexto = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Contexto) {
  try {
    const { id } = await params;
    const largo = Number(request.headers.get("content-length") ?? 0);
    if (largo > MAX_BYTES + 100_000) {
      throw new ErrorAplicacion("IMAGEN_GRANDE", 413, "La imagen pesa más de 3 MB. Toma la captura otra vez.");
    }
    const form = await request.formData().catch(() => null);
    const archivo = form?.get("imagen");
    const metodo = form?.get("metodo");
    if (!(archivo instanceof Blob) || (metodo !== "yape" && metodo !== "plin")) {
      throw new ErrorAplicacion("DATOS_INVALIDOS_PAGO", 400, "Elige Yape o Plin y adjunta la captura del pago.");
    }
    const imagen = new Uint8Array(await archivo.arrayBuffer());
    const r = await enviarComprobante(pagosConSesion(await crearClienteServidor()), id, metodo, imagen);
    return NextResponse.json({ ok: true, ...r }, { status: 201, headers: SIN_CACHE_PRIVADO });
  } catch (e) {
    return respuestaError(e);
  }
}
