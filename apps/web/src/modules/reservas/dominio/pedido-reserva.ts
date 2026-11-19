// Pedido de reserva: lo que manda el jugador al elegir un horario, y la regla
// para aceptarlo. Capa: dominio (función pura: se prueba con pruebas unitarias).
// Las reglas que dependen de los datos (horario de atención, cruces, precio)
// las aplica la base de datos dentro de fn_reservar, en una sola transacción.

import { ErrorAplicacion } from "@/modules/compartido/dominio/error-aplicacion";
import { esUUID } from "@/modules/compartido/dominio/validaciones";

export type PedidoReserva = {
  canchaId: string;
  inicio: string; // ISO
  fin: string; // ISO
  clave: string; // clave de idempotencia: una por intento (evita duplicados por doble clic)
};

export const datosInvalidos = () =>
  new ErrorAplicacion("DATOS_INVALIDOS_RESERVA", 400, "Los datos de la reserva no son válidos.");

export function validarPedido(x: unknown): PedidoReserva {
  const o = (x ?? {}) as Record<string, unknown>;
  const canchaId = String(o.canchaId ?? "");
  const inicio = String(o.inicio ?? "");
  const fin = String(o.fin ?? "");
  const clave = String(o.clave ?? "");
  const fecha = (s: string) => !Number.isNaN(Date.parse(s));
  if (!esUUID(canchaId) || !fecha(inicio) || !fecha(fin) || !/^[A-Za-z0-9-]{8,64}$/.test(clave)) throw datosInvalidos();
  return { canchaId, inicio: new Date(inicio).toISOString(), fin: new Date(fin).toISOString(), clave };
}
