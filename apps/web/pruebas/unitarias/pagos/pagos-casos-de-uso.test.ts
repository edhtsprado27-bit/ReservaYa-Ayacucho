// Casos de uso de pagos para el dueño y el admin (aplicación), con puertos falsos.
import {
  ENLACE_CAPTURA_SEGUNDOS,
  guardarDatosPago,
  revisarPago,
  verEstadoPago,
  verMisLocalesPago,
  verPagosPorRevisar,
} from "@/modules/pagos/aplicacion/pagos.casos-de-uso";
import type { PagoPorRevisar } from "@/modules/pagos/dominio/pago";
import type { AlmacenComprobantes, PagosRepositorio } from "@/modules/pagos/dominio/pagos.puertos";
import { ID_LOCAL, ID_PAGO, ID_RESERVA } from "../../apoyo/supabase-falso";

const pago = (ruta: string) => ({ pagoId: ID_PAGO, ruta, imagen: null }) as unknown as PagoPorRevisar;

function repo(lista: PagoPorRevisar[] = []) {
  return {
    estadoPago: jest.fn(async () => null),
    configIA: jest.fn(),
    registrarPago: jest.fn(),
    pagosPorRevisar: jest.fn(async () => lista),
    revisarPago: jest.fn(async () => ({ estadoReserva: "confirmed" })),
    misLocalesPago: jest.fn(async () => []),
    guardarDatosPago: jest.fn(async (_id: string, d: object) => d),
  } as unknown as jest.Mocked<PagosRepositorio>;
}

const almacen = () =>
  ({
    subir: jest.fn(),
    enlacesFirmados: jest.fn(async (rutas: string[]) => new Map(rutas.filter((r) => r !== "sin-firma").map((r) => [r, `https://firmado/${r}`]))),
  }) as unknown as jest.Mocked<AlmacenComprobantes>;

describe("casos de uso de pagos", () => {
  it("verEstadoPago no consulta con un id inválido", async () => {
    const r = repo();
    expect(await verEstadoPago(r, "x")).toBeNull();
    expect(r.estadoPago).not.toHaveBeenCalled();
    await verEstadoPago(r, ID_RESERVA);
    expect(r.estadoPago).toHaveBeenCalledWith(ID_RESERVA);
  });

  it("verPagosPorRevisar agrega enlaces temporales de 15 min a las capturas", async () => {
    const a = almacen();
    const lista = await verPagosPorRevisar(repo([pago("r1.png"), pago("sin-firma")]), a);
    expect(a.enlacesFirmados).toHaveBeenCalledWith(["r1.png", "sin-firma"], ENLACE_CAPTURA_SEGUNDOS);
    expect(ENLACE_CAPTURA_SEGUNDOS).toBe(900);
    expect(lista.map((p) => p.imagen)).toEqual(["https://firmado/r1.png", null]);
  });

  it("verPagosPorRevisar no pide enlaces si no hay pagos", async () => {
    const a = almacen();
    expect(await verPagosPorRevisar(repo([]), a)).toEqual([]);
    expect(a.enlacesFirmados).not.toHaveBeenCalled();
  });

  it("revisarPago valida el id y recorta el motivo a 200 caracteres", async () => {
    const r = repo();
    expect(() => revisarPago(r, "malo", true)).toThrow(expect.objectContaining({ codigo: "DATOS_INVALIDOS_PAGO" }));
    await revisarPago(r, ID_PAGO, false, "x".repeat(300));
    expect(r.revisarPago).toHaveBeenCalledWith(ID_PAGO, false, "x".repeat(200));
  });

  it("guardarDatosPago acepta solo textos (máx. 120) y valida el id", async () => {
    const r = repo();
    expect(() => guardarDatosPago(r, "malo", {})).toThrow(expect.objectContaining({ status: 400 }));
    await guardarDatosPago(r, ID_LOCAL, { yape: "966123456", plin: 123, titular: "J".repeat(150) });
    expect(r.guardarDatosPago).toHaveBeenCalledWith(ID_LOCAL, { yape: "966123456", plin: null, titular: "J".repeat(120) });
  });

  it("verMisLocalesPago delega en el repositorio", async () => {
    const r = repo();
    await verMisLocalesPago(r);
    expect(r.misLocalesPago).toHaveBeenCalled();
  });
});
