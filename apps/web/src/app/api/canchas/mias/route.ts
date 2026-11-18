// GET /api/canchas/mias -> canchas en revisión que puedes ver y editar
// (dueño: las suyas; admin: todas). Sin sesión: lista vacía.

import { connection, NextResponse } from "next/server";
import { crearClienteServidor } from "@/lib/auth/servidor";
import { aErrorCatalogo, listarPendientes } from "@/lib/catalogo-servidor";

const SIN_CACHE = { "Cache-Control": "private, no-store" };

export async function GET() {
  await connection(); // depende de la sesión: nunca se guarda en caché
  try {
    const db = await crearClienteServidor();
    const {
      data: { user },
    } = await db.auth.getUser();
    if (!user) return NextResponse.json({ canchas: [] }, { headers: SIN_CACHE });
    const canchas = await listarPendientes(db);
    return NextResponse.json({ canchas }, { headers: SIN_CACHE });
  } catch (e) {
    const err = aErrorCatalogo(e);
    return NextResponse.json({ error: err.message, codigo: err.codigo }, { status: err.status, headers: SIN_CACHE });
  }
}
