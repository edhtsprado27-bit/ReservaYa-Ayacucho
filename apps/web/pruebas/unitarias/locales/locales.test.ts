// Módulo locales (configuración del local y administración): reglas puras,
// validación de lo que llega del navegador y casos de uso con un repositorio falso.
import {
  agregarCanchaAlLocal,
  gestionarLocal,
  guardarAjustesLocal,
  guardarCanchaDelLocal,
  guardarServiciosLocal,
  quitarCanchaDelLocal,
  verConfiguracion,
  verLocalesAdmin,
  verMisLocales,
} from "@/modules/locales/aplicacion/locales.casos-de-uso";
import {
  diaValido,
  esDeporte,
  esHoraMedia,
  horasEntre,
  nombreDeporte,
  opcionesDuracion,
  resumenHorario,
} from "@/modules/locales/dominio/configuracion";
import type { LocalesRepositorio } from "@/modules/locales/dominio/locales.repositorio";
import { validarAjustes, validarCancha, validarNuevaCancha, validarPedidoAdmin, validarServicios } from "@/modules/locales/dominio/pedidos-locales";
import { ID_CANCHA, ID_LOCAL } from "../../apoyo/supabase-falso";

const todos = (abre: string, cierra: string) => [0, 1, 2, 3, 4, 5, 6].map((dia) => ({ dia, abre, cierra }));
const invalido = expect.objectContaining({ status: 400 });

describe("reglas del horario", () => {
  it("horas en punto o y media, de 00:00 a 24:00", () => {
    for (const h of ["00:00", "07:30", "23:30", "24:00"]) expect(esHoraMedia(h)).toBe(true);
    for (const h of ["24:30", "7:00", "08:15", "25:00", 800, null]) expect(esHoraMedia(h)).toBe(false);
  });

  it("horasEntre arma la lista cada 30 minutos", () => {
    expect(horasEntre("22:00", "24:00")).toEqual(["22:00", "22:30", "23:00", "23:30", "24:00"]);
    expect(horasEntre()).toHaveLength(49);
    expect(horasEntre("08:00", "10:00", 60)).toEqual(["08:00", "09:00", "10:00"]);
  });

  it("un día es válido si abre antes de cerrar y entra al menos un turno", () => {
    expect(diaValido({ dia: 1, abre: "08:00", cierra: "23:00" })).toBe(true);
    expect(diaValido({ dia: 1, abre: "08:00", cierra: "08:30" })).toBe(false);
    expect(diaValido({ dia: 1, abre: "08:00", cierra: "08:30" }, 30)).toBe(true);
    expect(diaValido({ dia: 1, abre: "20:00", cierra: "19:00" })).toBe(false);
    expect(diaValido({ dia: 1, abre: "8", cierra: "19:00" })).toBe(false);
  });

  it("resumen del horario agrupa días seguidos con las mismas horas", () => {
    expect(resumenHorario(todos("08:00", "23:00"))).toBe("Todos los días 08:00–23:00");
    const semana = [1, 2, 3, 4, 5, 6].map((dia) => ({ dia, abre: "07:00", cierra: "22:00" }));
    expect(resumenHorario(semana)).toBe("Lun a Sáb 07:00–22:00 · Dom cerrado");
    expect(resumenHorario([{ dia: 3, abre: "10:00", cierra: "12:00" }])).toBe("Lun a Mar cerrado · Mié 10:00–12:00 · Jue a Dom cerrado");
    expect(resumenHorario([])).toBe("Lun a Dom cerrado");
  });

  it("duraciones de un turno hasta 4 horas", () => {
    expect(opcionesDuracion(60)).toEqual([60, 120, 180, 240]);
    expect(opcionesDuracion(30)).toHaveLength(8);
  });

  it("deportes de la web", () => {
    expect(esDeporte("futbol")).toBe(true);
    expect(esDeporte("tenis")).toBe(false);
    expect(nombreDeporte("voley")).toBe("Vóley");
    expect(nombreDeporte("basquet")).toBe("Multideporte");
  });
});

describe("validación de pedidos", () => {
  it("ajustes: recorta textos y exige números enteros", () => {
    expect(validarAjustes({ direccion: "  Jr. Lima 123 ", referencia: " ", whatsapp: "966123456", adelantoPct: "30", minutosApartado: 15, horasCancelacion: 6 })).toEqual({
      direccion: "Jr. Lima 123",
      referencia: null,
      whatsapp: "966123456",
      adelantoPct: 30,
      minutosApartado: 15,
      horasCancelacion: 6,
    });
    expect(() => validarAjustes({ direccion: "x", adelantoPct: 12.5, minutosApartado: 15, horasCancelacion: 6 })).toThrow(invalido);
    expect(() => validarAjustes(null)).toThrow(invalido);
  });

  const cancha = { nombre: " Cancha 1 ", deporte: "futbol", techada: true, maxMinutos: 120, horario: todos("08:00", "23:00"), precio: "60,50" };

  it("cancha: precio con coma, sin hora punta", () => {
    expect(validarCancha(cancha)).toEqual(
      expect.objectContaining({ nombre: "Cancha 1", deporte: "futbol", techada: true, precio: 60.5, precioPunta: null, puntaDesde: null }),
    );
    expect(validarCancha({ ...cancha, techada: "si", precioPunta: "" }).techada).toBe(false);
  });

  it("cancha: con hora punta", () => {
    expect(validarCancha({ ...cancha, precioPunta: 80, puntaDesde: "18:00" })).toEqual(expect.objectContaining({ precioPunta: 80, puntaDesde: "18:00" }));
  });

  it.each([
    ["deporte desconocido", { ...cancha, deporte: "tenis" }],
    ["precio 0", { ...cancha, precio: 0 }],
    ["precio que no es número", { ...cancha, precio: "barato" }],
    ["hora punta sin hora", { ...cancha, precioPunta: 80 }],
    ["horario que no es lista", { ...cancha, horario: "todos" }],
    ["más de 7 días", { ...cancha, horario: [...todos("08:00", "23:00"), { dia: 1, abre: "08:00", cierra: "09:00" }] }],
    ["día 7", { ...cancha, horario: [{ dia: 7, abre: "08:00", cierra: "23:00" }] }],
    ["hora 08:15", { ...cancha, horario: [{ dia: 1, abre: "08:15", cierra: "23:00" }] }],
    ["máximo con decimales", { ...cancha, maxMinutos: 90.5 }],
  ])("cancha rechaza %s", (_caso, datos) => {
    expect(() => validarCancha(datos)).toThrow(invalido);
  });

  it("nueva cancha", () => {
    expect(validarNuevaCancha({ nombre: "Cancha 3", deporte: "futsal", precio: 55 })).toEqual({ nombre: "Cancha 3", deporte: "futsal", precio: 55 });
    expect(() => validarNuevaCancha({ nombre: "Cancha 3", deporte: "futsal" })).toThrow(invalido);
  });

  it("servicios: limpia, ordena y quita repetidos; un código desconocido es error", () => {
    expect(validarServicios({ servicios: [" Duchas", "vestuarios", "duchas"] })).toEqual(["vestuarios", "duchas"]);
    expect(validarServicios({ servicios: [] })).toEqual([]);
    expect(() => validarServicios({ servicios: ["piscina"] })).toThrow(expect.objectContaining({ codigo: "SERVICIO_INVALIDO", status: 400 }));
    expect(() => validarServicios({ servicios: [1] })).toThrow(expect.objectContaining({ codigo: "SERVICIO_INVALIDO" }));
    expect(() => validarServicios({ servicios: "duchas" })).toThrow(invalido);
    expect(() => validarServicios({ servicios: Array(21).fill("duchas") })).toThrow(invalido);
    expect(() => validarServicios(null)).toThrow(invalido);
  });

  it("pedidos del administrador", () => {
    expect(validarPedidoAdmin({ accion: "asignar_dueno", correo: "  Juan@Gmail.com " })).toEqual({ accion: "asignar_dueno", correo: "juan@gmail.com" });
    expect(validarPedidoAdmin({ accion: "suspender", motivo: " Reclamos " })).toEqual({ accion: "suspender", motivo: "Reclamos" });
    expect(validarPedidoAdmin({ accion: "reactivar" })).toEqual({ accion: "reactivar" });
    expect(() => validarPedidoAdmin({ accion: "asignar_dueno", correo: "juan" })).toThrow(expect.objectContaining({ codigo: "CORREO_INVALIDO" }));
    expect(() => validarPedidoAdmin({ accion: "borrar" })).toThrow(invalido);
    expect(() => validarPedidoAdmin([])).toThrow(invalido);
  });
});

describe("casos de uso", () => {
  function repoFalso() {
    const cambio = { id: ID_LOCAL, slug: "la-bombonera" };
    const repo = {
      misLocales: jest.fn(async () => []),
      config: jest.fn(async () => ({})),
      guardarAjustes: jest.fn(async () => cambio),
      guardarServicios: jest.fn(async () => ({ ...cambio, servicios: [] })),
      guardarCancha: jest.fn(async () => ({ ...cambio, fueraDeHorario: 0 })),
      agregarCancha: jest.fn(async () => cambio),
      quitarCancha: jest.fn(async () => cambio),
      localesAdmin: jest.fn(async () => []),
      asignarDueno: jest.fn(async () => cambio),
      cambiarEstado: jest.fn(async () => cambio),
    };
    return repo as unknown as jest.Mocked<LocalesRepositorio>;
  }

  it("validan el id antes de ir a la base", async () => {
    const repo = repoFalso();
    expect(() => verConfiguracion(repo, "x")).toThrow(invalido);
    expect(() => guardarCanchaDelLocal(repo, "123", {})).toThrow(invalido);
    expect(() => quitarCanchaDelLocal(repo, "")).toThrow(invalido);
    expect(() => gestionarLocal(repo, "x", { accion: "reactivar" })).toThrow(invalido);
    expect(() => guardarServiciosLocal(repo, "x", { servicios: [] })).toThrow(invalido);
    expect(repo.config).not.toHaveBeenCalled();
  });

  it("pasan los datos ya validados al repositorio", async () => {
    const repo = repoFalso();
    await verMisLocales(repo);
    await verLocalesAdmin(repo);
    await verConfiguracion(repo, ID_LOCAL);
    expect(repo.config).toHaveBeenCalledWith(ID_LOCAL);

    await guardarAjustesLocal(repo, ID_LOCAL, { direccion: "Jr. Lima 123", adelantoPct: 50, minutosApartado: 15, horasCancelacion: 6 });
    expect(repo.guardarAjustes).toHaveBeenCalledWith(ID_LOCAL, expect.objectContaining({ adelantoPct: 50, whatsapp: null }));

    await guardarCanchaDelLocal(repo, ID_CANCHA, { nombre: "C1", deporte: "voley", maxMinutos: 60, horario: [], precio: 40 });
    expect(repo.guardarCancha).toHaveBeenCalledWith(ID_CANCHA, expect.objectContaining({ deporte: "voley", horario: [] }));

    await agregarCanchaAlLocal(repo, ID_LOCAL, { nombre: "C2", deporte: "futbol", precio: 50 });
    expect(repo.agregarCancha).toHaveBeenCalledWith(ID_LOCAL, { nombre: "C2", deporte: "futbol", precio: 50 });

    await quitarCanchaDelLocal(repo, ID_CANCHA);
    expect(repo.quitarCancha).toHaveBeenCalledWith(ID_CANCHA);

    await guardarServiciosLocal(repo, ID_LOCAL, { servicios: ["iluminacion", "banos"] });
    expect(repo.guardarServicios).toHaveBeenCalledWith(ID_LOCAL, ["banos", "iluminacion"]);
  });

  it("el administrador asigna, suspende y reactiva", async () => {
    const repo = repoFalso();
    await gestionarLocal(repo, ID_LOCAL, { accion: "asignar_dueno", correo: "juan@gmail.com" });
    expect(repo.asignarDueno).toHaveBeenCalledWith(ID_LOCAL, "juan@gmail.com");
    await gestionarLocal(repo, ID_LOCAL, { accion: "suspender", motivo: "Reclamos" });
    expect(repo.cambiarEstado).toHaveBeenCalledWith(ID_LOCAL, "suspender", "Reclamos");
    await gestionarLocal(repo, ID_LOCAL, { accion: "reactivar", motivo: "ignorado" });
    expect(repo.cambiarEstado).toHaveBeenLastCalledWith(ID_LOCAL, "reactivar", null);
  });
});
