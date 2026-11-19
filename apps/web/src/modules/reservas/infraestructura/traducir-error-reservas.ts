// Errores de las funciones de reservas en PostgreSQL -> códigos de la aplicación.
// Los del trigger de la base vienen en inglés y se pasan a nuestros códigos.

import type { ErrorAplicacion } from "@/modules/compartido/dominio/error-aplicacion";
import { aErrorAplicacion } from "@/modules/compartido/infraestructura/supabase/traducir-error";
import { datosInvalidos } from "../dominio/pedido-reserva";

const DEL_TRIGGER: Record<string, string> = {
  BOOKING_IN_PAST: "HORARIO_PASADO",
  COURT_NOT_BOOKABLE: "CANCHA_NO_DISPONIBLE",
  OUTSIDE_OPERATING_HOURS: "HORARIO_INVALIDO",
  COURT_BLACKOUT: "HORARIO_CERRADO",
};

export function traducirErrorReservas(e: { message?: string; code?: string }): ErrorAplicacion {
  const msg = e.message ?? "";
  if (msg === "DATOS_INVALIDOS") return datosInvalidos();
  return aErrorAplicacion(Object.assign(new Error(DEL_TRIGGER[msg] ?? msg), { code: e.code }));
}
