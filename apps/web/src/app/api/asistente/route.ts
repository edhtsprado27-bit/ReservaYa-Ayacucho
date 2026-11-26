// POST /api/asistente  { mensaje, filtros?, historial? }  -> respuesta del asistente (RF09)
// Cualquiera puede usarlo. Lo simple lo responden las reglas; lo libre, la IA
// (solo con sesión y cupo diario). Las canchas y horas salen de la base de datos.
// Máximo 20 mensajes por minuto por IP.

import { connection, NextResponse } from "next/server";
import { consultarAsistente } from "@/modules/asistente/aplicacion/asistente.casos-de-uso";
import { asistenteConSesion } from "@/modules/asistente/infraestructura/composicion";
import { crearError } from "@/modules/compartido/dominio/error-aplicacion";
import { crearLimite, ipDe } from "@/modules/compartido/infraestructura/limite-por-clave";
import { crearClienteServidor } from "@/modules/compartido/infraestructura/supabase/cliente-servidor";
import { respuestaError, SIN_CACHE_PRIVADO } from "@/modules/compartido/presentacion/http";

const permitir = crearLimite({ maximo: 20, ventanaMs: 60_000 });

export async function POST(request: Request) {
  await connection(); // depende de la sesión y de la hora: siempre en el momento del pedido
  try {
    if (!permitir(ipDe(request))) throw crearError("DEMASIADOS_MENSAJES");
    const datos = await request.json().catch(() => null);
    const respuesta = await consultarAsistente(asistenteConSesion(await crearClienteServidor()), datos);
    return NextResponse.json({ ok: true, respuesta }, { headers: SIN_CACHE_PRIVADO });
  } catch (e) {
    return respuestaError(e);
  }
}
