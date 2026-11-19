// Pagos en Supabase. Solo en el servidor, siempre con la sesión de quien lo pide:
// la base de datos decide qué puede ver y hacer cada uno (jugador, dueño, admin).

import "server-only";
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { aErrorCatalogo, ErrorCatalogo } from "../catalogo-servidor";
import { leerComprobante, type ConfigIA } from "./ocr";
import {
  aEstadoPago,
  aLocalPago,
  aPagoPorRevisar,
  type EstadoPago,
  type LocalPago,
  type MetodoPago,
  type PagoPorRevisar,
} from "./pagos";
import { destinatarioCoincide, fechaLeidaAISO, operacionLimpia } from "./verificar";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BUCKET = "comprobantes";
export const MAX_BYTES = 3 * 1024 * 1024;

const error = (codigo: string, status: number, mensaje: string) => new ErrorCatalogo(codigo, status, mensaje);
const traducir = (e: { message?: string; code?: string }) =>
  aErrorCatalogo(Object.assign(new Error(e.message ?? ""), { code: e.code }));

export function validarUUID(id: string) {
  if (!UUID.test(id)) throw error("DATOS_INVALIDOS_PAGO", 400, "Los datos del pago no son válidos.");
  return id;
}

// ---------------------------------------------------------------------
// Imagen: se revisa el contenido real (no solo el nombre del archivo)
// ---------------------------------------------------------------------
export function tipoDeImagen(b: Buffer): { mime: string; ext: "jpg" | "png" | "webp" } | null {
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { mime: "image/jpeg", ext: "jpg" };
  if (b.length > 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])))
    return { mime: "image/png", ext: "png" };
  if (b.length > 12 && b.subarray(0, 4).toString() === "RIFF" && b.subarray(8, 12).toString() === "WEBP")
    return { mime: "image/webp", ext: "webp" };
  return null;
}

// ---------------------------------------------------------------------
// Jugador
// ---------------------------------------------------------------------
export async function estadoPago(db: SupabaseClient, reservaId: string): Promise<EstadoPago | null> {
  if (!UUID.test(reservaId)) return null;
  const { data, error: e } = await db.rpc("fn_estado_pago", { p_reserva: reservaId });
  if (e) throw traducir(e);
  return data ? aEstadoPago(data) : null;
}

async function configIA(db: SupabaseClient): Promise<ConfigIA | null> {
  const { data, error: e } = await db.rpc("fn_config_ia", { p_funcion: "receipt_ocr" });
  if (e || !data) return null;
  return {
    modelo: String(data.modelo ?? ""),
    respaldo: Array.isArray(data.respaldo) ? data.respaldo.map(String) : [],
    temperatura: Number(data.temperatura ?? 0),
    maxTokens: Number(data.max_tokens ?? 1000),
    prompt: data.prompt ?? null,
    version: data.version ?? null,
  };
}

export type PagoEnviado = { pago: string; estadoPago: string; resultado: string | null };

/**
 * 1) revisa la reserva, 2) sube la captura al bucket privado, 3) la IA la lee,
 * 4) la base guarda el pago, compara con lo esperado y aparta la hora.
 */
export async function enviarComprobante(
  db: SupabaseClient,
  reservaId: string,
  metodo: MetodoPago,
  imagen: Buffer,
): Promise<PagoEnviado> {
  validarUUID(reservaId);
  if (imagen.length > MAX_BYTES) throw error("IMAGEN_GRANDE", 413, "La imagen pesa más de 3 MB. Toma la captura otra vez.");
  const tipo = tipoDeImagen(imagen);
  if (!tipo) throw error("IMAGEN_INVALIDA", 400, "Sube una captura en JPG, PNG o WEBP.");

  // Antes de gastar en la IA: ¿la reserva es tuya y sigue por pagar?
  const estado = await estadoPago(db, reservaId);
  if (!estado) throw traducir({ message: "RESERVA_NO_ENCONTRADA" });
  if (estado.pago && estado.pago.estado !== "rejected") throw traducir({ message: "PAGO_YA_ENVIADO" });
  if (estado.estado !== "pending_payment" && estado.estado !== "expired") throw traducir({ message: "PAGO_YA_ENVIADO" });

  const sha256 = createHash("sha256").update(imagen).digest("hex");
  const ruta = `${reservaId}/${sha256}.${tipo.ext}`;
  const subida = await db.storage.from(BUCKET).upload(ruta, imagen, { contentType: tipo.mime, upsert: false });
  if (subida.error && !/exist|duplicate/i.test(subida.error.message)) {
    console.error("[pagos] No se pudo subir la captura:", subida.error.message);
    if (/row-level security|unauthorized|403/i.test(subida.error.message)) throw traducir({ message: "RESERVA_VENCIDA" });
    throw error("SUBIDA_FALLIDA", 502, "No se pudo subir la captura. Revisa tu conexión e inténtalo otra vez.");
  }

  const { lectura, ia } = await leerComprobante(imagen, tipo.mime, await configIA(db));
  const datosLectura = lectura && {
    es_comprobante: lectura.es_comprobante,
    app: lectura.app,
    monto: lectura.monto,
    operacion: operacionLimpia(lectura.numero_operacion),
    fecha: fechaLeidaAISO(lectura.fecha_hora),
    destinatario: lectura.destinatario,
    destinatario_coincide: destinatarioCoincide(lectura.destinatario, estado.titular),
    confianza: lectura.confianza,
    salida: lectura,
  };

  const { data, error: e } = await db.rpc("fn_registrar_pago", {
    p_reserva: reservaId,
    p_metodo: metodo,
    p_ruta: ruta,
    p_sha256: sha256,
    p_lectura: datosLectura,
    p_ia: ia,
  });
  if (e) throw traducir(e);
  return { pago: String(data.pago), estadoPago: String(data.estado_pago), resultado: data.resultado ?? null };
}

// ---------------------------------------------------------------------
// Dueño y admin
// ---------------------------------------------------------------------
export async function pagosPorRevisar(db: SupabaseClient): Promise<PagoPorRevisar[]> {
  const { data, error: e } = await db.rpc("fn_pagos_por_revisar");
  if (e) throw traducir(e);
  const pagos = (data ?? []).map(aPagoPorRevisar);
  if (!pagos.length) return pagos;

  // Enlaces temporales (15 min) para ver las capturas del bucket privado
  const { data: firmas } = await db.storage.from(BUCKET).createSignedUrls(
    pagos.map((p: PagoPorRevisar) => p.ruta),
    900,
  );
  const porRuta = new Map((firmas ?? []).map((f) => [f.path, f.signedUrl]));
  return pagos.map((p: PagoPorRevisar) => ({ ...p, imagen: porRuta.get(p.ruta) ?? null }));
}

export async function revisarPago(db: SupabaseClient, pagoId: string, aprobar: boolean, motivo?: string) {
  validarUUID(pagoId);
  const { data, error: e } = await db.rpc("fn_revisar_pago", {
    p_pago: pagoId,
    p_aprobar: aprobar,
    p_motivo: motivo?.slice(0, 200) ?? null,
  });
  if (e) throw traducir(e);
  return { estadoReserva: String(data.estado_reserva) };
}

export async function misLocalesPago(db: SupabaseClient): Promise<LocalPago[]> {
  const { data, error: e } = await db.rpc("fn_mis_locales_pago");
  if (e) throw traducir(e);
  return (data ?? []).map(aLocalPago);
}

export async function guardarDatosPago(
  db: SupabaseClient,
  localId: string,
  datos: { yape?: unknown; plin?: unknown; titular?: unknown },
) {
  validarUUID(localId);
  const texto = (v: unknown) => (typeof v === "string" ? v.slice(0, 120) : null);
  const { data, error: e } = await db.rpc("fn_guardar_datos_pago", {
    p_local: localId,
    p_yape: texto(datos.yape),
    p_plin: texto(datos.plin),
    p_titular: texto(datos.titular),
  });
  if (e) throw traducir(e);
  return data as { yape: string | null; plin: string | null; titular: string | null };
}
