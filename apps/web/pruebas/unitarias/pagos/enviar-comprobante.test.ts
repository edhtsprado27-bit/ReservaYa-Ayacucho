// Caso de uso "enviar comprobante" (módulo pagos, aplicación), probado con
// implementaciones falsas de sus puertos: sin base de datos, Storage ni IA reales.
import { enviarComprobante, type DependenciasPago } from "@/modules/pagos/aplicacion/enviar-comprobante";
import { MAX_BYTES } from "@/modules/pagos/dominio/imagen";
import type { EstadoPago } from "@/modules/pagos/dominio/pago";
import type { ResultadoOCR } from "@/modules/pagos/dominio/pagos.puertos";
import { ID_RESERVA, PNG } from "../../apoyo/supabase-falso";

const estadoPorPagar: EstadoPago = {
  estado: "pending_payment",
  adelanto: 50,
  vence: null,
  yape: "966123456",
  plin: null,
  titular: "Juan Pérez",
  pago: null,
};

function dependencias(o: { estado?: EstadoPago | null; ocr?: ResultadoOCR; subida?: Awaited<ReturnType<DependenciasPago["almacen"]["subir"]>> } = {}) {
  const d = {
    pagos: {
      estadoPago: jest.fn(async () => (o.estado === undefined ? estadoPorPagar : o.estado)),
      configIA: jest.fn(async () => ({ modelo: "m", respaldo: [], temperatura: 0, maxTokens: 100, prompt: null, version: "v1" })),
      registrarPago: jest.fn(async () => ({ pago: "pago-1", estadoPago: "submitted", resultado: null })),
      pagosPorRevisar: jest.fn(),
      revisarPago: jest.fn(),
      misLocalesPago: jest.fn(),
      guardarDatosPago: jest.fn(),
    },
    almacen: { subir: jest.fn(async () => o.subida ?? { ok: true as const }), enlacesFirmados: jest.fn() },
    lector: { leer: jest.fn(async () => o.ocr ?? { lectura: null, ia: null }) },
    huella: jest.fn(() => "huella123"),
  };
  return d as typeof d & DependenciasPago;
}

const codigo = (p: Promise<unknown>) => p.then(() => "SIN_ERROR", (e) => e.codigo);

describe("enviarComprobante", () => {
  it("rechaza un id de reserva inválido sin tocar nada", async () => {
    const d = dependencias();
    expect(await codigo(enviarComprobante(d, "abc", "yape", PNG))).toBe("DATOS_INVALIDOS_PAGO");
    expect(d.pagos.estadoPago).not.toHaveBeenCalled();
  });

  it("rechaza imágenes de más de 3 MB y archivos que no son imagen", async () => {
    const d = dependencias();
    expect(await codigo(enviarComprobante(d, ID_RESERVA, "yape", new Uint8Array(MAX_BYTES + 1)))).toBe("IMAGEN_GRANDE");
    expect(await codigo(enviarComprobante(d, ID_RESERVA, "yape", new TextEncoder().encode("no soy imagen")))).toBe("IMAGEN_INVALIDA");
    expect(d.almacen.subir).not.toHaveBeenCalled();
  });

  it("no gasta en la IA si la reserva no es suya o ya tiene un pago enviado", async () => {
    expect(await codigo(enviarComprobante(dependencias({ estado: null }), ID_RESERVA, "yape", PNG))).toBe("RESERVA_NO_ENCONTRADA");

    const conPago = dependencias({
      estado: { ...estadoPorPagar, pago: { id: "p", estado: "submitted", metodo: "yape", monto: 50, operacion: null, motivo: null, enviado: "", resultado: null, leido: null } },
    });
    expect(await codigo(enviarComprobante(conPago, ID_RESERVA, "yape", PNG))).toBe("PAGO_YA_ENVIADO");
    expect(conPago.lector.leer).not.toHaveBeenCalled();

    const confirmada = dependencias({ estado: { ...estadoPorPagar, estado: "confirmed" } });
    expect(await codigo(enviarComprobante(confirmada, ID_RESERVA, "yape", PNG))).toBe("PAGO_YA_ENVIADO");
  });

  it("permite reenviar si el pago anterior fue rechazado o la reserva venció", async () => {
    const rechazado = dependencias({
      estado: { ...estadoPorPagar, pago: { id: "p", estado: "rejected", metodo: "yape", monto: 50, operacion: null, motivo: "x", enviado: "", resultado: null, leido: null } },
    });
    expect(await codigo(enviarComprobante(rechazado, ID_RESERVA, "plin", PNG))).toBe("SIN_ERROR");
    const vencida = dependencias({ estado: { ...estadoPorPagar, estado: "expired" } });
    expect(await codigo(enviarComprobante(vencida, ID_RESERVA, "plin", PNG))).toBe("SIN_ERROR");
  });

  it("traduce los fallos al subir la captura", async () => {
    const sinPermiso = dependencias({ subida: { ok: false, motivo: "sin_permiso" } });
    expect(await codigo(enviarComprobante(sinPermiso, ID_RESERVA, "yape", PNG))).toBe("RESERVA_VENCIDA");
    const fallo = dependencias({ subida: { ok: false, motivo: "fallo" } });
    expect(await codigo(enviarComprobante(fallo, ID_RESERVA, "yape", PNG))).toBe("SUBIDA_FALLIDA");
    expect(fallo.lector.leer).not.toHaveBeenCalled();
  });

  it("sube la captura con su huella, la hace leer y registra el pago con la lectura revisada", async () => {
    const ia = { modelo_pedido: "m", modelo_usado: "m", generacion: "g", tokens_entrada: 10, tokens_salida: 5, costo_usd: 0, latencia_ms: 900, estado: "success" as const, error: null };
    const d = dependencias({
      ocr: {
        lectura: {
          es_comprobante: true,
          app: "yape",
          monto: 50,
          numero_operacion: "N° 0012-3456",
          fecha_hora: "2026-11-18T19:15",
          destinatario: "Juan Pér***",
          confianza: 0.9,
        },
        ia,
      },
    });

    const r = await enviarComprobante(d, ID_RESERVA, "yape", PNG);

    expect(r).toEqual({ pago: "pago-1", estadoPago: "submitted", resultado: null });
    expect(d.almacen.subir).toHaveBeenCalledWith(`${ID_RESERVA}/huella123.png`, PNG, "image/png");
    expect(d.lector.leer).toHaveBeenCalledWith(PNG, "image/png", expect.objectContaining({ modelo: "m" }));
    expect(d.pagos.registrarPago).toHaveBeenCalledWith({
      reservaId: ID_RESERVA,
      metodo: "yape",
      ruta: `${ID_RESERVA}/huella123.png`,
      sha256: "huella123",
      ia,
      lectura: expect.objectContaining({
        monto: 50,
        operacion: "00123456",
        fecha: "2026-11-19T00:15:00.000Z",
        destinatario_coincide: true,
        confianza: 0.9,
      }),
    });
  });

  it("si la IA no puede leer, el pago igual se registra para revisión manual", async () => {
    const d = dependencias({ ocr: { lectura: null, ia: null } });
    await enviarComprobante(d, ID_RESERVA, "plin", PNG);
    expect(d.pagos.registrarPago).toHaveBeenCalledWith(expect.objectContaining({ lectura: null, ia: null, metodo: "plin" }));
  });
});
