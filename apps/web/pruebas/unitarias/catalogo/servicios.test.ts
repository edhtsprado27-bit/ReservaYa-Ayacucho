// Servicios del local (dominio del catálogo): lista fija, orden y filtro del mapa.
import { esServicio, nombreServicio, ordenarServicios, SERVICIOS, tieneServicios } from "@/modules/catalogo/dominio/servicios";

describe("servicios del local", () => {
  it("la lista tiene los mismos 8 códigos que la tabla amenities (012)", () => {
    expect(SERVICIOS.map((s) => s.codigo)).toEqual([
      "vestuarios", "duchas", "banos", "estacionamiento", "cafeteria", "tribuna", "iluminacion", "balon_incluido",
    ]);
    expect(new Set(SERVICIOS.map((s) => s.codigo)).size).toBe(SERVICIOS.length);
  });

  it("reconoce códigos y da su nombre", () => {
    expect(esServicio("duchas")).toBe(true);
    expect(esServicio("piscina")).toBe(false);
    expect(esServicio(3)).toBe(false);
    expect(nombreServicio("banos")).toBe("Baños");
    expect(nombreServicio("sauna")).toBe("sauna");
  });

  it("ordena como la lista, sin repetidos ni desconocidos", () => {
    expect(ordenarServicios(["tribuna", "vestuarios", "sauna", "tribuna", 5])).toEqual(["vestuarios", "tribuna"]);
    expect(ordenarServicios(null)).toEqual([]);
    expect(ordenarServicios(undefined)).toEqual([]);
  });

  it("filtro del mapa: el local debe tener TODOS los servicios marcados", () => {
    expect(tieneServicios(["vestuarios", "duchas"], [])).toBe(true);
    expect(tieneServicios(["vestuarios", "duchas"], ["duchas"])).toBe(true);
    expect(tieneServicios(["vestuarios", "duchas"], ["duchas", "tribuna"])).toBe(false);
    expect(tieneServicios(undefined, ["duchas"])).toBe(false);
    expect(tieneServicios(undefined, [])).toBe(true);
  });
});
