// PUT    /api/canchas/:id  -> corrige una cancha que sigue en revisión (devuelve un id nuevo)
// DELETE /api/canchas/:id  -> quita una cancha que sigue en revisión
// Solo su dueño o el admin. Las canchas ya aprobadas no se cambian desde aquí.

import { NextResponse } from "next/server";
import { crearClienteServidor } from "@/lib/auth/servidor";
import {
  aErrorCatalogo,
  reemplazarPropuesta,
  retirarPropuesta,
  validarId,
  validarNuevaCancha,
} from "@/lib/catalogo-servidor";

type Contexto = { params: Promise<{ id: string }> };
const SIN_CACHE = { "Cache-Control": "no-store" };

function respuestaError(e: unknown) {
  const err = aErrorCatalogo(e);
  return NextResponse.json(
    { ok: false, error: err.message, codigo: err.codigo },
    { status: err.status, headers: SIN_CACHE },
  );
}

export async function PUT(request: Request, { params }: Contexto) {
  try {
    const id = validarId((await params).id);
    const cuerpo = await request.json().catch(() => null);
    const r = await reemplazarPropuesta(await crearClienteServidor(), id, validarNuevaCancha(cuerpo));
    return NextResponse.json({ ok: true, ...r }, { headers: SIN_CACHE });
  } catch (e) {
    return respuestaError(e);
  }
}

export async function DELETE(_request: Request, { params }: Contexto) {
  try {
    const id = validarId((await params).id);
    await retirarPropuesta(await crearClienteServidor(), id);
    return NextResponse.json({ ok: true }, { headers: SIN_CACHE });
  } catch (e) {
    return respuestaError(e);
  }
}
