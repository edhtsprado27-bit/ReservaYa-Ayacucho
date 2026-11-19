// Módulo catálogo: reglas de la cancha y ubicación (dominio), caché (Decorator)
// y casos de uso (aplicación).
import {
  corregirCancha,
  quitarCancha,
  registrarCancha,
  revisarCancha,
  verCatalogo,
  verMisPublicadas,
  verPendientes,
} from "@/modules/catalogo/aplicacion/catalogo.casos-de-uso";
import { deporteABD, deporteAWeb, distritoAWeb, normalizar } from "@/modules/catalogo/dominio/cancha";
import type { CatalogoRepositorio } from "@/modules/catalogo/dominio/catalogo.repositorio";
import { dentroDeHuamanga, distanciaKm, enlaceGoogleMaps, enlaceWaze, PLAZA_DE_ARMAS } from "@/modules/catalogo/dominio/ubicacion";
import { validarId, validarNuevaCancha } from "@/modules/catalogo/dominio/validar-nueva-cancha";
import { CatalogoEnCache } from "@/modules/catalogo/infraestructura/catalogo-en-cache";
import { ID_LOCAL } from "../../apoyo/supabase-falso";

describe("reglas de la cancha", () => {
  it("normaliza textos para comparar", () => {
    expect(normalizar("Jesús Nazareno")).toBe("jesusnazareno");
  });
  it("convierte los deportes entre la web y la base", () => {
    expect(deporteABD("Fútbol")).toBe("futbol");
    expect(deporteABD("Vóley")).toBe("voley");
    expect(deporteABD("voli")).toBe("voley");
    expect(deporteABD("Futsal")).toBe("futsal");
    expect(deporteABD("tenis")).toBeNull();
    expect(deporteAWeb("futbol")).toBe("Fútbol");
    expect(deporteAWeb("polo")).toBeNull();
  });
  it("muestra el nombre corto del distrito", () => {
    expect(distritoAWeb("Andrés Avelino Cáceres Dorregaray")).toBe("Andrés Avelino Cáceres D.");
    expect(distritoAWeb("Ayacucho")).toBe("Ayacucho");
    expect(distritoAWeb("Huanta")).toBe("Huanta");
  });
});

describe("ubicación", () => {
  it("calcula distancias (Haversine)", () => {
    expect(distanciaKm(PLAZA_DE_ARMAS, PLAZA_DE_ARMAS)).toBe(0);
    expect(distanciaKm({ lat: -13.1588, lng: -74.2239 }, { lat: -13.1688, lng: -74.2239 })).toBeCloseTo(1.11, 2);
  });
  it("sabe si un punto está dentro de Huamanga", () => {
    expect(dentroDeHuamanga(PLAZA_DE_ARMAS)).toBe(true);
    expect(dentroDeHuamanga({ lat: -12.04, lng: -77.03 })).toBe(false); // Lima
  });
  it("arma los enlaces de Cómo llegar", () => {
    expect(enlaceWaze({ lat: -13.16, lng: -74.22 })).toBe("https://waze.com/ul?ll=-13.16,-74.22&navigate=yes");
    expect(enlaceGoogleMaps({ lat: -13.16, lng: -74.22 })).toBe("https://www.google.com/maps/dir/?api=1&destination=-13.16,-74.22");
  });
});

describe("validarNuevaCancha", () => {
  it("acepta coma decimal y limpia los datos", () => {
    expect(
      validarNuevaCancha({ nombre: " El Golazo ", distrito: "Ayacucho", lat: -13.16, lng: "-74,22", deportes: ["Fútbol", 3], precioDesde: "0" }),
    ).toEqual({
      nombre: "El Golazo",
      distrito: "Ayacucho",
      lat: -13.16,
      lng: -74.22,
      direccion: undefined,
      referencia: undefined,
      deportes: ["Fútbol"],
      techada: false,
      precioDesde: undefined,
      telefono: undefined,
    });
  });
  it("rechaza si falta el nombre, el distrito o la ubicación", () => {
    for (const malo of [null, {}, { nombre: "A", distrito: "B" }, { nombre: "A", distrito: "B", lat: "x", lng: 1 }]) {
      expect(() => validarNuevaCancha(malo)).toThrow(expect.objectContaining({ codigo: "DATOS_INVALIDOS", status: 400 }));
    }
  });
  it("un id que no es UUID no existe", () => {
    expect(() => validarId("x")).toThrow(expect.objectContaining({ codigo: "PROPUESTA_NO_ENCONTRADA", status: 404 }));
    expect(validarId(ID_LOCAL)).toBe(ID_LOCAL);
  });
});

function repoFalso() {
  const repo = {
    leerPublicadas: jest.fn(async () => ({ canchas: [], generado: "2026-11-19T00:00:00.000Z" })),
    proponer: jest.fn(async () => ({ id: ID_LOCAL, slug: "nueva", estado: "pending_review" })),
    reemplazar: jest.fn(async () => ({ id: ID_LOCAL, slug: "nueva", estado: "pending_review" })),
    retirar: jest.fn(async () => undefined),
    listarPendientes: jest.fn(async () => []),
    listarPublicadasDe: jest.fn(async () => []),
    revisar: jest.fn(async (id: string, aprobar: boolean) => ({ id, nombre: "X", estado: aprobar ? "approved" : "rejected" })),
  };
  return repo as unknown as jest.Mocked<CatalogoRepositorio>;
}

describe("CatalogoEnCache (patrón Decorator)", () => {
  it("reutiliza la lectura durante 30 s y vuelve a la base al vencer", async () => {
    let ahora = 0;
    const origen = repoFalso();
    const cache = new CatalogoEnCache(origen, 30_000, () => ahora);
    await cache.leerPublicadas();
    ahora = 29_000;
    await cache.leerPublicadas();
    expect(origen.leerPublicadas).toHaveBeenCalledTimes(1);
    ahora = 31_000;
    await cache.leerPublicadas();
    expect(origen.leerPublicadas).toHaveBeenCalledTimes(2);
  });

  it("varias visitas a la vez comparten una sola consulta", async () => {
    const origen = repoFalso();
    const cache = new CatalogoEnCache(origen);
    await Promise.all([cache.leerPublicadas(), cache.leerPublicadas(), cache.leerPublicadas()]);
    expect(origen.leerPublicadas).toHaveBeenCalledTimes(1);
  });

  it("al aprobar una cancha borra la caché; al rechazar no", async () => {
    const origen = repoFalso();
    const cache = new CatalogoEnCache(origen);
    await cache.leerPublicadas();
    await cache.revisar(ID_LOCAL, false);
    await cache.leerPublicadas();
    expect(origen.leerPublicadas).toHaveBeenCalledTimes(1);
    await cache.revisar(ID_LOCAL, true);
    await cache.leerPublicadas();
    expect(origen.leerPublicadas).toHaveBeenCalledTimes(2);
  });

  it("si la base falla no guarda nada y el siguiente intento vuelve a consultar", async () => {
    const origen = repoFalso();
    origen.leerPublicadas.mockRejectedValueOnce(new Error("SIN_CONEXION"));
    const cache = new CatalogoEnCache(origen);
    await expect(cache.leerPublicadas()).rejects.toThrow("SIN_CONEXION");
    await cache.leerPublicadas();
    expect(origen.leerPublicadas).toHaveBeenCalledTimes(2);
  });

  it("las demás operaciones pasan directo al repositorio", async () => {
    const origen = repoFalso();
    const cache = new CatalogoEnCache(origen);
    const nueva = { nombre: "A", distrito: "Ayacucho", lat: -13.16, lng: -74.22 };
    await cache.proponer(nueva);
    await cache.reemplazar(ID_LOCAL, nueva);
    await cache.retirar(ID_LOCAL);
    await cache.listarPendientes();
    await cache.listarPublicadasDe("dueno");
    expect(origen.proponer).toHaveBeenCalledWith(nueva);
    expect(origen.reemplazar).toHaveBeenCalledWith(ID_LOCAL, nueva);
    expect(origen.retirar).toHaveBeenCalledWith(ID_LOCAL);
    expect(origen.listarPendientes).toHaveBeenCalled();
    expect(origen.listarPublicadasDe).toHaveBeenCalledWith("dueno");
  });
});

describe("casos de uso del catálogo", () => {
  const datos = { nombre: "El Golazo", distrito: "Ayacucho", lat: -13.16, lng: -74.22 };

  it("registrarCancha valida antes de guardar", async () => {
    const repo = repoFalso();
    expect(() => registrarCancha(repo, { nombre: "Sin ubicación" })).toThrow();
    expect(repo.proponer).not.toHaveBeenCalled();
    await registrarCancha(repo, datos);
    expect(repo.proponer).toHaveBeenCalledWith(expect.objectContaining({ nombre: "El Golazo", techada: false }));
  });

  it("corregir, quitar y revisar validan el id", async () => {
    const repo = repoFalso();
    expect(() => corregirCancha(repo, "x", datos)).toThrow();
    expect(() => quitarCancha(repo, "x")).toThrow();
    expect(() => revisarCancha(repo, "x", true)).toThrow();
    await corregirCancha(repo, ID_LOCAL, datos);
    await quitarCancha(repo, ID_LOCAL);
    await revisarCancha(repo, ID_LOCAL, true, "ok");
    expect(repo.reemplazar).toHaveBeenCalledWith(ID_LOCAL, expect.objectContaining({ nombre: "El Golazo" }));
    expect(repo.retirar).toHaveBeenCalledWith(ID_LOCAL);
    expect(repo.revisar).toHaveBeenCalledWith(ID_LOCAL, true, "ok");
  });

  it("las consultas delegan en el repositorio", async () => {
    const repo = repoFalso();
    await verCatalogo(repo);
    await verPendientes(repo);
    await verMisPublicadas(repo, "dueno-1");
    expect(repo.leerPublicadas).toHaveBeenCalled();
    expect(repo.listarPendientes).toHaveBeenCalled();
    expect(repo.listarPublicadasDe).toHaveBeenCalledWith("dueno-1");
  });
});
