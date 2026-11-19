// Caso de uso: el jugador envía la captura del adelanto (RF05, RF06).
// Capa: aplicación. Coordina los pasos; cada dependencia llega por parámetro.
//  1) revisa la reserva, 2) sube la captura al almacén privado,
//  3) la IA la lee, 4) la base guarda el pago, compara con lo esperado y aparta la hora.
// La IA nunca confirma el pago: solo ayuda al dueño, que es quien decide.

import { ErrorAplicacion } from "@/modules/compartido/dominio/error-aplicacion";
import { crearError } from "@/modules/compartido/dominio/error-aplicacion";
import { esUUID } from "@/modules/compartido/dominio/validaciones";
import { MAX_BYTES, tipoDeImagen } from "../dominio/imagen";
import type { MetodoPago } from "../dominio/pago";
import type {
  AlmacenComprobantes,
  CalcularHuella,
  DatosLectura,
  LectorComprobantes,
  PagoEnviado,
  PagosRepositorio,
} from "../dominio/pagos.puertos";
import { destinatarioCoincide, fechaLeidaAISO, operacionLimpia } from "../dominio/verificar";

export type DependenciasPago = {
  pagos: PagosRepositorio;
  almacen: AlmacenComprobantes;
  lector: LectorComprobantes;
  huella: CalcularHuella;
};

export const datosPagoInvalidos = () =>
  new ErrorAplicacion("DATOS_INVALIDOS_PAGO", 400, "Los datos del pago no son válidos.");

export async function enviarComprobante(
  d: DependenciasPago,
  reservaId: string,
  metodo: MetodoPago,
  imagen: Uint8Array,
): Promise<PagoEnviado> {
  if (!esUUID(reservaId)) throw datosPagoInvalidos();
  if (imagen.length > MAX_BYTES) throw new ErrorAplicacion("IMAGEN_GRANDE", 413, "La imagen pesa más de 3 MB. Toma la captura otra vez.");
  const tipo = tipoDeImagen(imagen);
  if (!tipo) throw new ErrorAplicacion("IMAGEN_INVALIDA", 400, "Sube una captura en JPG, PNG o WEBP.");

  // 1) Antes de gastar en la IA: ¿la reserva es tuya y sigue por pagar?
  const estado = await d.pagos.estadoPago(reservaId);
  if (!estado) throw crearError("RESERVA_NO_ENCONTRADA");
  if (estado.pago && estado.pago.estado !== "rejected") throw crearError("PAGO_YA_ENVIADO");
  if (estado.estado !== "pending_payment" && estado.estado !== "expired") throw crearError("PAGO_YA_ENVIADO");

  // 2) Captura al almacén privado (el nombre es su huella: la misma imagen no se duplica)
  const sha256 = d.huella(imagen);
  const ruta = `${reservaId}/${sha256}.${tipo.ext}`;
  const subida = await d.almacen.subir(ruta, imagen, tipo.mime);
  if (!subida.ok) {
    if (subida.motivo === "sin_permiso") throw crearError("RESERVA_VENCIDA");
    throw new ErrorAplicacion("SUBIDA_FALLIDA", 502, "No se pudo subir la captura. Revisa tu conexión e inténtalo otra vez.");
  }

  // 3) La IA lee la captura (si falla, el pago sigue y el dueño revisa a mano)
  const { lectura, ia } = await d.lector.leer(imagen, tipo.mime, await d.pagos.configIA());
  const datosLectura: DatosLectura | null = lectura && {
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

  // 4) La base guarda el pago y lo compara con lo esperado
  return d.pagos.registrarPago({ reservaId, metodo, ruta, sha256, lectura: datosLectura, ia });
}
