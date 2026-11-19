// Conversión de las filas que devuelven las funciones de pagos de Supabase a
// las entidades del dominio. Capa: infraestructura.

import type {
  EstadoPago,
  EstadoPagoBD,
  Leido,
  LocalPago,
  MetodoPago,
  PagoPorRevisar,
  ResultadoLectura,
} from "../dominio/pago";

type Json = Record<string, unknown>;
const num = (v: unknown) => (v == null || v === "" ? null : Number(v));
const txt = (v: unknown) => (v == null || v === "" ? null : String(v));

function aLeido(j: unknown): Leido | null {
  if (!j || typeof j !== "object") return null;
  const o = j as Json;
  return { app: txt(o.app), monto: num(o.monto), operacion: txt(o.operacion), fecha: txt(o.fecha), destinatario: txt(o.destinatario) };
}

export function aEstadoPago(j: Json): EstadoPago {
  const p = j.pago as Json | null;
  return {
    estado: String(j.estado),
    adelanto: Number(j.adelanto),
    vence: txt(j.vence),
    yape: txt(j.yape),
    plin: txt(j.plin),
    titular: txt(j.titular),
    pago: p
      ? {
          id: String(p.id),
          estado: String(p.estado) as EstadoPagoBD,
          metodo: String(p.metodo) as MetodoPago,
          monto: Number(p.monto),
          operacion: txt(p.operacion),
          motivo: txt(p.motivo),
          enviado: String(p.enviado),
          resultado: (txt(p.resultado) as ResultadoLectura | null) ?? null,
          leido: aLeido(p.leido),
        }
      : null,
  };
}

export function aPagoPorRevisar(f: Json): PagoPorRevisar {
  const leido =
    f.resultado == null
      ? null
      : {
          app: null,
          monto: num(f.leido_monto),
          operacion: txt(f.leido_operacion),
          fecha: txt(f.leido_fecha),
          destinatario: txt(f.leido_destinatario),
        };
  return {
    pagoId: String(f.pago_id),
    estadoPago: String(f.estado_pago) as EstadoPagoBD,
    metodo: String(f.metodo) as MetodoPago,
    monto: Number(f.monto),
    operacion: txt(f.operacion),
    ruta: String(f.ruta),
    imagen: null,
    enviado: String(f.enviado),
    reservaId: String(f.reserva_id),
    codigo: String(f.codigo),
    inicio: String(f.inicio),
    fin: String(f.fin),
    total: Number(f.total),
    adelanto: Number(f.adelanto),
    cancha: String(f.cancha),
    local: String(f.local),
    jugador: txt(f.jugador),
    telefonoJugador: txt(f.telefono_jugador),
    yape: txt(f.yape),
    plin: txt(f.plin),
    titular: txt(f.titular),
    resultado: (txt(f.resultado) as ResultadoLectura | null) ?? null,
    leido,
  };
}

export function aLocalPago(f: Json): LocalPago {
  return {
    id: String(f.id),
    nombre: String(f.nombre),
    estado: String(f.estado),
    yape: txt(f.yape),
    plin: txt(f.plin),
    titular: txt(f.titular),
    adelantoPct: Number(f.adelanto_pct ?? 50),
  };
}
