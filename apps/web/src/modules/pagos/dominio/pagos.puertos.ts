// Puertos (interfaces) del módulo de pagos: QUÉ necesita, sin decir CÓMO.
// Implementaciones en infraestructura/: Supabase (base de datos y Storage) y
// OpenRouter (IA). Gracias a esto el caso de uso "enviar comprobante" se puede
// probar con implementaciones falsas y cambiar de proveedor sin tocarlo.

import type { ConfigIA, RegistroIA } from "@/modules/compartido/dominio/ia";
import type { EstadoPago, LocalPago, MetodoPago, PagoPorRevisar } from "./pago";
import type { LecturaIA } from "./verificar";

// ---------------------------------------------------------------------
// IA (lectura del comprobante)
// ---------------------------------------------------------------------
// Tipos comunes de la IA (también los usa el asistente)
export type { ConfigIA, RegistroIA } from "@/modules/compartido/dominio/ia";

export type ResultadoOCR = { lectura: LecturaIA | null; ia: RegistroIA | null };

export interface LectorComprobantes {
  /** Lee la captura. Si no hay IA o falla, devuelve lectura null (revisión manual). */
  leer(imagen: Uint8Array, mime: string, config: ConfigIA | null): Promise<ResultadoOCR>;
}

// ---------------------------------------------------------------------
// Almacén privado de capturas
// ---------------------------------------------------------------------
export type ResultadoSubida = { ok: true } | { ok: false; motivo: "sin_permiso" | "fallo" };

export interface AlmacenComprobantes {
  subir(ruta: string, imagen: Uint8Array, mime: string): Promise<ResultadoSubida>;
  /** Enlaces temporales para ver las capturas (ruta -> url) */
  enlacesFirmados(rutas: string[], segundos: number): Promise<Map<string, string>>;
}

// ---------------------------------------------------------------------
// Base de datos
// ---------------------------------------------------------------------
export type DatosLectura = {
  es_comprobante: boolean;
  app: string | null;
  monto: number | null;
  operacion: string | null;
  fecha: string | null;
  destinatario: string | null;
  destinatario_coincide: boolean | null;
  confianza: number;
  salida: LecturaIA;
};

export type NuevoPago = {
  reservaId: string;
  metodo: MetodoPago;
  ruta: string;
  sha256: string;
  lectura: DatosLectura | null;
  ia: RegistroIA | null;
};

export type PagoEnviado = { pago: string; estadoPago: string; resultado: string | null };

export type DatosPagoLocal = { yape: string | null; plin: string | null; titular: string | null };

export interface PagosRepositorio {
  estadoPago(reservaId: string): Promise<EstadoPago | null>;
  configIA(): Promise<ConfigIA | null>;
  /** Guarda el pago; la base compara con lo esperado y deja la reserva en revisión */
  registrarPago(p: NuevoPago): Promise<PagoEnviado>;
  pagosPorRevisar(): Promise<PagoPorRevisar[]>;
  revisarPago(pagoId: string, aprobar: boolean, motivo?: string): Promise<{ estadoReserva: string }>;
  misLocalesPago(): Promise<LocalPago[]>;
  guardarDatosPago(localId: string, datos: { yape: string | null; plin: string | null; titular: string | null }): Promise<DatosPagoLocal>;
}

/** Huella SHA-256 de la imagen (detecta la misma captura subida dos veces) */
export type CalcularHuella = (imagen: Uint8Array) => string;
