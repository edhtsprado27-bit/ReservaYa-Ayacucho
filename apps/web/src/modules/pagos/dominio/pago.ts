// Entidades y textos de los pagos (Yape/Plin). Capa: dominio.
// Sin nada del servidor: se usa en el navegador (subir comprobante, panel del
// dueño) y en las rutas /api.

export type MetodoPago = "yape" | "plin";

export type ResultadoLectura =
  | "match"
  | "amount_mismatch"
  | "recipient_mismatch"
  | "date_out_of_range"
  | "duplicate_operation"
  | "unreadable";

export type EstadoPagoBD = "submitted" | "ai_verified" | "ai_flagged" | "approved" | "rejected";

// Lo que leyó la IA de la captura
export type Leido = {
  app: string | null;
  monto: number | null;
  operacion: string | null;
  fecha: string | null;
  destinatario: string | null;
};

// fn_estado_pago: a quién pagar y en qué va el último comprobante
export type EstadoPago = {
  estado: string;
  adelanto: number;
  vence: string | null;
  yape: string | null;
  plin: string | null;
  titular: string | null;
  pago: {
    id: string;
    estado: EstadoPagoBD;
    metodo: MetodoPago;
    monto: number;
    operacion: string | null;
    motivo: string | null;
    enviado: string;
    resultado: ResultadoLectura | null;
    leido: Leido | null;
  } | null;
};

// fn_pagos_por_revisar (panel del dueño)
export type PagoPorRevisar = {
  pagoId: string;
  estadoPago: EstadoPagoBD;
  metodo: MetodoPago;
  monto: number;
  operacion: string | null;
  ruta: string;
  imagen: string | null; // enlace firmado, vence en minutos
  enviado: string;
  reservaId: string;
  codigo: string;
  inicio: string;
  fin: string;
  total: number;
  adelanto: number;
  cancha: string;
  local: string;
  jugador: string | null;
  telefonoJugador: string | null;
  yape: string | null;
  plin: string | null;
  titular: string | null;
  resultado: ResultadoLectura | null;
  leido: Leido | null;
};

// fn_mis_locales_pago (formulario de datos de pago)
export type LocalPago = {
  id: string;
  nombre: string;
  estado: string;
  yape: string | null;
  plin: string | null;
  titular: string | null;
  adelantoPct: number;
};

export const METODO_TEXTO: Record<MetodoPago, string> = { yape: "Yape", plin: "Plin" };

// Texto corto para el dueño
export const RESULTADO_CORTO: Record<ResultadoLectura, string> = {
  match: "Coincide",
  amount_mismatch: "Monto menor",
  recipient_mismatch: "Otro destinatario",
  date_out_of_range: "Fecha distinta",
  duplicate_operation: "Comprobante repetido",
  unreadable: "No se pudo leer",
};

// Texto para el jugador mientras espera
export function resultadoParaJugador(r: ResultadoLectura | null, leido: Leido | null, adelanto: number): string {
  switch (r) {
    case "match":
      return "Coincide con el adelanto. Solo falta que el local lo confirme.";
    case "amount_mismatch":
      return `El monto que leímos${leido?.monto != null ? ` (S/ ${leido.monto})` : ""} es menor que el adelanto (S/ ${adelanto}). El local lo revisará.`;
    case "recipient_mismatch":
      return "El destinatario no parece ser el del local. El local lo revisará.";
    case "date_out_of_range":
      return "La fecha del pago no coincide con esta reserva. El local lo revisará.";
    case "duplicate_operation":
      return "Ese comprobante ya se usó en otra reserva. El local lo revisará.";
    case "unreadable":
      return "No pudimos leer bien la captura. El local la revisará a mano.";
    default:
      return "El local revisará tu comprobante.";
  }
}

/** 966123456 -> "966 123 456" */
export const celularTexto = (c: string | null | undefined) =>
  c ? c.replace(/\D/g, "").replace(/^(\d{3})(\d{3})(\d{3})$/, "$1 $2 $3") : "";
