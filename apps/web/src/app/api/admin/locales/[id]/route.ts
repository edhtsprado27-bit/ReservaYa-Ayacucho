// POST /api/admin/locales/:id  { "accion": "aprobar" | "rechazar", "motivo"?: string }
// Solo el administrador (lo verifica la base de datos con fn_revisar_local).

import { NextResponse } from "next/server";
import { crearClienteServidor } from "@/lib/auth/servidor";
import { aErrorCatalogo, revisarLocal, validarId } from "@/lib/catalogo-servidor";

type Contexto = { params: Promise<{ id: string }> };
const SIN_CACHE = { "Cache-Control": "no-store" };

export async function POST(request: Request, { params }: Contexto) {
  try {
    const id = validarId((await params).id);
    const cuerpo = (await request.json().catch(() => ({}))) as { accion?: string; motivo?: string };
    if (cuerpo.accion !== "aprobar" && cuerpo.accion !== "rechazar") {
      return NextResponse.json({ ok: false, error: "Acción no válida.", codigo: "DATOS_INVALIDOS" }, { status: 400 });
    }
    const r = await revisarLocal(await crearClienteServidor(), id, cuerpo.accion === "aprobar", cuerpo.motivo);
    return NextResponse.json({ ok: true, ...r }, { headers: SIN_CACHE });
  } catch (e) {
    const err = aErrorCatalogo(e);
    return NextResponse.json({ ok: false, error: err.message, codigo: err.codigo }, { status: err.status, headers: SIN_CACHE });
  }
}
