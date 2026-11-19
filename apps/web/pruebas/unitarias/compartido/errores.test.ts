// Errores de la aplicación y traducción de los errores de Supabase.
import { crearError, ErrorAplicacion } from "@/modules/compartido/dominio/error-aplicacion";
import { esSlug, esUUID } from "@/modules/compartido/dominio/validaciones";
import { aErrorAplicacion, traducirErrorSupabase } from "@/modules/compartido/infraestructura/supabase/traducir-error";
import { traducirErrorReservas } from "@/modules/reservas/infraestructura/traducir-error-reservas";
import { ID_LOCAL } from "../../apoyo/supabase-falso";

describe("crearError", () => {
  it("usa el estado HTTP y el mensaje de cada código", () => {
    const e = crearError("HORARIO_OCUPADO");
    expect(e).toBeInstanceOf(ErrorAplicacion);
    expect(e.status).toBe(409);
    expect(e.message).toMatch(/Alguien acaba de reservar/);
  });
  it("un código desconocido se vuelve DESCONOCIDO (500)", () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    expect(crearError("NO_EXISTE").codigo).toBe("DESCONOCIDO");
    expect(crearError("DESCONOCIDO", "detalle").status).toBe(500);
  });
});

describe("traducirErrorSupabase", () => {
  beforeEach(() => jest.spyOn(console, "error").mockImplementation(() => {}));
  it.each([
    [{ message: "HORARIO_OCUPADO" }, "HORARIO_OCUPADO"],
    [{ code: "PGRST202", message: "no existe" }, "FALTA_MIGRACION"],
    [{ code: "42883" }, "FALTA_MIGRACION"],
    [{ code: "42501" }, "SIN_SESION"],
    [{ message: "permission denied for table bookings" }, "SIN_SESION"],
    [{ message: "Invalid API key" }, "CLAVE_INVALIDA"],
    [{ message: "TypeError: fetch failed" }, "SIN_CONEXION"],
    [{ message: "algo raro" }, "DESCONOCIDO"],
    [null, "DESCONOCIDO"],
  ])("%j -> %s", (entrada, codigo) => {
    expect(traducirErrorSupabase(entrada).codigo).toBe(codigo);
  });
});

describe("aErrorAplicacion", () => {
  it("convierte cualquier error en un ErrorAplicacion", () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    const propio = new ErrorAplicacion("X", 418, "y");
    expect(aErrorAplicacion(propio)).toBe(propio);
    expect(aErrorAplicacion(new Error("PAGO_YA_ENVIADO")).codigo).toBe("PAGO_YA_ENVIADO");
    expect(aErrorAplicacion(new Error("FALTA_CONFIGURAR_SUPABASE")).status).toBe(500);
    expect(aErrorAplicacion("texto").codigo).toBe("DESCONOCIDO");
  });
});

describe("errores de reservas (trigger de la base)", () => {
  it("traduce los mensajes en inglés del trigger", () => {
    expect(traducirErrorReservas({ message: "BOOKING_IN_PAST" }).codigo).toBe("HORARIO_PASADO");
    expect(traducirErrorReservas({ message: "COURT_BLACKOUT" }).codigo).toBe("HORARIO_CERRADO");
    expect(traducirErrorReservas({ message: "DATOS_INVALIDOS" }).codigo).toBe("DATOS_INVALIDOS_RESERVA");
    expect(traducirErrorReservas({ message: "DEMASIADAS_PENDIENTES" }).status).toBe(429);
  });
});

describe("validaciones de formato", () => {
  it("reconoce UUID y slugs", () => {
    expect(esUUID(ID_LOCAL)).toBe(true);
    expect(esUUID("1234")).toBe(false);
    expect(esSlug("cancha-demo-2")).toBe(true);
    expect(esSlug("Cancha Demo")).toBe(false);
  });
});
