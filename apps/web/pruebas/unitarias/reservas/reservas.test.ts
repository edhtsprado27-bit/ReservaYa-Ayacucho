// Módulo reservas: regla del pedido (dominio), fechas y casos de uso (aplicación).
import {
  cancelarReserva,
  reservarHorario,
  verDisponibilidad,
  verLocal,
  verMisReservas,
} from "@/modules/reservas/aplicacion/reservas.casos-de-uso";
import { validarPedido } from "@/modules/reservas/dominio/pedido-reserva";
import { esActiva, ESTADO_TEXTO } from "@/modules/reservas/dominio/reserva";
import type { ReservasRepositorio } from "@/modules/reservas/dominio/reservas.repositorio";
import {
  diasParaElegir,
  duracionTexto,
  esFechaValida,
  fechaLarga,
  fechaLima,
  horaLima,
  minutosTexto,
  nuevaClave,
  rangoTexto,
  soles,
  sumarDias,
} from "@/modules/reservas/dominio/tiempo";
import { ID_CANCHA, ID_LOCAL, ID_RESERVA } from "../../apoyo/supabase-falso";

const pedidoValido = {
  canchaId: ID_CANCHA,
  inicio: "2026-12-01T19:00:00-05:00",
  fin: "2026-12-01T21:00:00-05:00",
  clave: "clave-de-prueba-123",
};

describe("validarPedido", () => {
  it("acepta un pedido válido y pasa las horas a UTC", () => {
    expect(validarPedido(pedidoValido)).toEqual({
      canchaId: ID_CANCHA,
      inicio: "2026-12-02T00:00:00.000Z",
      fin: "2026-12-02T02:00:00.000Z",
      clave: "clave-de-prueba-123",
    });
  });
  it.each([
    ["cancha que no es UUID", { ...pedidoValido, canchaId: "1" }],
    ["inicio inválido", { ...pedidoValido, inicio: "mañana" }],
    ["fin inválido", { ...pedidoValido, fin: "" }],
    ["clave muy corta", { ...pedidoValido, clave: "abc" }],
    ["clave con símbolos", { ...pedidoValido, clave: "clave con espacios!" }],
    ["cuerpo vacío", null],
  ])("rechaza %s", (_caso, pedido) => {
    expect(() => validarPedido(pedido)).toThrow(expect.objectContaining({ codigo: "DATOS_INVALIDOS_RESERVA", status: 400 }));
  });
  it("la clave que genera el navegador siempre es aceptada", () => {
    for (let i = 0; i < 20; i++) expect(() => validarPedido({ ...pedidoValido, clave: nuevaClave() })).not.toThrow();
  });
});

describe("estados de la reserva", () => {
  it("solo las reservas activas ocupan el horario", () => {
    expect(esActiva("pending_payment")).toBe(true);
    expect(esActiva("payment_review")).toBe(true);
    expect(esActiva("confirmed")).toBe(true);
    expect(esActiva("cancelled")).toBe(false);
    expect(esActiva("expired")).toBe(false);
    expect(ESTADO_TEXTO.pending_payment).toBe("Por pagar");
  });
});

describe("fechas en hora de Ayacucho (UTC-5)", () => {
  it("convierte instantes a fecha y hora de Lima", () => {
    expect(fechaLima(new Date("2026-11-19T03:00:00Z"))).toBe("2026-11-18");
    expect(horaLima("2026-11-19T00:15:00Z")).toBe("19:15");
  });
  it("suma días cruzando meses y años", () => {
    expect(sumarDias("2026-12-31", 1)).toBe("2027-01-01");
    expect(sumarDias("2026-03-01", -1)).toBe("2026-02-28");
  });
  it("valida el formato de fecha", () => {
    expect(esFechaValida("2026-12-01")).toBe(true);
    expect(esFechaValida("ayer")).toBe(false);
    expect(esFechaValida("2026-1-1")).toBe(false);
  });
  it("arma los días del selector empezando por hoy", () => {
    const dias = diasParaElegir("2026-11-19", 3);
    expect(dias.map((d) => d.fecha)).toEqual(["2026-11-19", "2026-11-20", "2026-11-21"]);
    expect(dias[0].arriba).toBe("Hoy");
    expect(dias[1].arriba).toBe("Mañana");
    expect(diasParaElegir("2026-11-19")).toHaveLength(14);
  });
  it("da formato a duraciones, montos y rangos", () => {
    expect(minutosTexto(90)).toBe("1 h 30 min");
    expect(minutosTexto(60)).toBe("1 h");
    expect(minutosTexto(45)).toBe("45 min");
    expect(duracionTexto(pedidoValido.inicio, pedidoValido.fin)).toBe("2 h");
    expect(soles(50)).toBe("S/ 50");
    expect(soles(12.5)).toBe("S/ 12.50");
    expect(rangoTexto(pedidoValido.inicio, pedidoValido.fin)).toMatch(/19:00 – 21:00$/);
    // la coma después del día depende de la versión de ICU de Node
    expect(fechaLarga(pedidoValido.inicio)).toMatch(/^Martes,? 1 de diciembre$/);
  });
});

function repoFalso() {
  const repo = {
    leerLocal: jest.fn(async () => null),
    disponibilidad: jest.fn(async () => []),
    reservar: jest.fn(async () => ({ id: ID_RESERVA }) as never),
    misReservas: jest.fn(async () => []),
    cancelar: jest.fn(async () => ({ conDevolucion: false })),
  };
  return repo as unknown as jest.Mocked<ReservasRepositorio>;
}

describe("casos de uso de reservas", () => {
  it("verLocal no consulta con un slug inválido", async () => {
    const repo = repoFalso();
    expect(await verLocal(repo, "Slug Con Espacios")).toBeNull();
    expect(repo.leerLocal).not.toHaveBeenCalled();
    await verLocal(repo, "cancha-demo");
    expect(repo.leerLocal).toHaveBeenCalledWith("cancha-demo");
  });

  it("verDisponibilidad valida el local y la fecha", async () => {
    const repo = repoFalso();
    expect(() => verDisponibilidad(repo, "x", "2026-12-01")).toThrow(expect.objectContaining({ status: 400 }));
    expect(() => verDisponibilidad(repo, ID_LOCAL, "ayer")).toThrow(expect.objectContaining({ status: 400 }));
    await verDisponibilidad(repo, ID_LOCAL, "2026-12-01");
    expect(repo.disponibilidad).toHaveBeenCalledWith(ID_LOCAL, "2026-12-01");
  });

  it("reservarHorario valida antes de llamar al repositorio", async () => {
    const repo = repoFalso();
    expect(() => reservarHorario(repo, { canchaId: "x" })).toThrow();
    expect(repo.reservar).not.toHaveBeenCalled();
    await reservarHorario(repo, pedidoValido);
    expect(repo.reservar).toHaveBeenCalledWith(validarPedido(pedidoValido));
  });

  it("verMisReservas devuelve vacío para un id inválido", async () => {
    const repo = repoFalso();
    expect(await verMisReservas(repo, "no-es-uuid")).toEqual([]);
    expect(repo.misReservas).not.toHaveBeenCalled();
    await verMisReservas(repo);
    await verMisReservas(repo, ID_RESERVA);
    expect(repo.misReservas).toHaveBeenNthCalledWith(1, undefined);
    expect(repo.misReservas).toHaveBeenNthCalledWith(2, ID_RESERVA);
  });

  it("cancelarReserva valida el id y recorta el motivo", async () => {
    const repo = repoFalso();
    expect(() => cancelarReserva(repo, "x")).toThrow(expect.objectContaining({ codigo: "DATOS_INVALIDOS_RESERVA" }));
    await cancelarReserva(repo, ID_RESERVA, "m".repeat(250));
    expect(repo.cancelar).toHaveBeenCalledWith(ID_RESERVA, "m".repeat(200));
  });
});
