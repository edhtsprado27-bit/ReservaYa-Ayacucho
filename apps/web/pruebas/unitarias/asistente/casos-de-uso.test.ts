// Caso de uso del asistente con datos falsos: sin base de datos ni IA real.
// "Ahora": domingo 22/11/2026, 10:30 en Ayacucho.
import { consultarAsistente, NO_ENTENDI, SALUDO, type DepsAsistente } from "@/modules/asistente/aplicacion/asistente.casos-de-uso";
import { SIN_FILTROS, type Interpretacion } from "@/modules/asistente/dominio/asistente";
import type { ControlIA, Cupo, FuenteCanchas, InterpreteIA } from "@/modules/asistente/dominio/asistente.puertos";
import type { ConfigIA, RegistroIA } from "@/modules/compartido/dominio/ia";
import { CATALOGO, grilla, local } from "../../apoyo/asistente-datos";

const AHORA = new Date("2026-11-22T15:30:00Z");
const MANANA = "2026-11-23";
const CONFIG: ConfigIA = { modelo: "m:free", respaldo: [], temperatura: 0.2, maxTokens: 900, prompt: null, version: "asistente-v1" };
const REGISTRO: RegistroIA = {
  modelo_pedido: "m:free",
  modelo_usado: "m:free",
  generacion: "gen-1",
  tokens_entrada: 900,
  tokens_salida: 60,
  costo_usd: 0,
  latencia_ms: 800,
  estado: "success",
  error: null,
};

function fuenteFalsa(x: Partial<FuenteCanchas> = {}): FuenteCanchas & { [k: string]: jest.Mock } {
  return {
    publicadas: jest.fn(async () => CATALOGO),
    local: jest.fn(async (slug: string) => local(slug)),
    turnos: jest.fn(async (localId: string, fecha: string) => grilla(`${localId.replace("local-", "")}-c1`, fecha, ["19:00"])),
    ...x,
  } as FuenteCanchas & { [k: string]: jest.Mock };
}

function iaFalsa(interp: Interpretacion | null, cupo: Cupo = { permitido: true, motivo: null, limiteCuenta: 10 }) {
  const control = {
    cupo: jest.fn(async () => cupo),
    config: jest.fn(async (): Promise<ConfigIA | null> => CONFIG),
    registrar: jest.fn(async () => undefined),
  } satisfies ControlIA;
  const interprete = { interpretar: jest.fn(async () => ({ interpretacion: interp, ia: REGISTRO })) } satisfies InterpreteIA;
  return { control, interprete };
}

const deps = (x: Partial<DepsAsistente> = {}): DepsAsistente => ({ fuente: fuenteFalsa(), ia: null, ahora: AHORA, ...x });
const preguntar = (mensaje: string, d = deps(), extra: object = {}) => consultarAsistente(d, { mensaje, ...extra });

describe("con las reglas (sin IA)", () => {
  it("busca horas libres reales y arma los enlaces a la grilla", async () => {
    const fuente = fuenteFalsa();
    const r = await preguntar("fútbol en Carmen Alto mañana a las 7", deps({ fuente }));
    expect(r.modo).toBe("reglas");
    expect(r.aviso).toBeNull();
    expect(r.entendido).toEqual(["Fútbol", "Carmen Alto", "lun 23 nov", "19:00"]);
    expect(r.texto).toBe("A las 19:00 no hay canchas de fútbol en Carmen Alto libres mañana, pero estas horas cercanas sí:");
    expect(r.recomendaciones.map((x) => x.slug)).toEqual(["la-canchita", "los-andes"]);
    expect(r.recomendaciones[0].horas.map((h) => h.hora)).toEqual(["17:00", "18:00", "20:00", "21:00"]);
    expect(r.recomendaciones[0].horas[1].enlace).toBe(`/cancha/la-canchita?fecha=${MANANA}&cancha=la-canchita-c1&desde=18:00&hasta=19:00`);
    expect(r.filtros).toEqual({ ...SIN_FILTROS, deporte: "Fútbol", distrito: "Carmen Alto", fecha: MANANA, hora: "19:00" });
    expect(r.sugerencias).toEqual(["Una hora más tarde", "¿Cómo pago el adelanto?"]);
    expect(fuente.turnos).toHaveBeenCalledWith("local-la-canchita", MANANA);
    expect(fuente.local).not.toHaveBeenCalledWith("grass-sjb"); // no es de Carmen Alto
  });

  it("sigue la conversación con los filtros anteriores", async () => {
    const previos = { ...SIN_FILTROS, deporte: "Fútbol", distrito: "Carmen Alto", fecha: MANANA, hora: "19:00" };
    const r = await preguntar("¿y a las 8?", deps(), { filtros: previos });
    expect(r.filtros.hora).toBe("20:00");
    expect(r.texto).toMatch(/^Para mañana a las 20:00 encontré 2 locales/);
    expect(r.recomendaciones.every((x) => x.exacta)).toBe(true);
  });

  it("sin día, muestra los locales y pide el día", async () => {
    const r = await preguntar("canchas con duchas en Carmen Alto");
    expect(r.texto).toMatch(/^Encontré 1 local con canchas en Carmen Alto con duchas\. Dime el día/);
    expect(r.recomendaciones).toEqual([expect.objectContaining({ slug: "los-andes", horas: [], enlace: "/cancha/los-andes" })]);
    expect(r.sugerencias).toEqual(["Hoy en la noche", "Mañana a las 19:00"]);
  });

  it("sin resultados, sugiere quitar filtros", async () => {
    const r = await preguntar("vóley en San Juan con duchas mañana");
    expect(r.texto).toMatch(/^No encontré locales/);
    expect(r.recomendaciones).toEqual([]);
    expect(r.sugerencias).toEqual(["Sin duchas", "En cualquier distrito", "Mañana"]);
    const lleno = fuenteFalsa({ turnos: jest.fn(async () => []) });
    const r2 = await preguntar("fútbol mañana a las 7", deps({ fuente: lleno }));
    expect(r2.texto).toMatch(/^No quedan horas libres/);
    expect(r2.sugerencias).toEqual(["Una hora más tarde"]);
  });

  it("saludo, duda y lo que no entiende", async () => {
    const hola = await preguntar("hola");
    expect(hola).toEqual(expect.objectContaining({ texto: SALUDO, modo: "reglas", recomendaciones: [] }));
    expect(hola.sugerencias).toHaveLength(3);

    const duda = await preguntar("¿Cómo pago el adelanto?");
    expect(duda.texto).toMatch(/Yape o Plin/);
    expect(duda.sugerencias[0]).toBe("Fútbol hoy en la noche");
    expect(duda.sugerencias).not.toContain("¿Cómo pago el adelanto?");

    const otro = await preguntar("cuéntame un chiste");
    expect(otro).toEqual(expect.objectContaining({ texto: NO_ENTENDI, modo: "reglas", aviso: null }));
  });

  it("avisa si la fecha está fuera del rango", async () => {
    const r = await preguntar("fútbol el 20 de diciembre");
    expect(r.aviso).toBe("Solo se puede reservar hasta el sábado 5 de diciembre.");
  });

  it("si falla la base, lo dice sin romperse", async () => {
    const sinCatalogo = fuenteFalsa({ publicadas: jest.fn(async () => Promise.reject(new Error("caída"))) });
    expect((await preguntar("fútbol mañana a las 7", deps({ fuente: sinCatalogo }))).texto).toMatch(/^No pude consultar las canchas/);
    const sinGrilla = fuenteFalsa({ turnos: jest.fn(async () => Promise.reject(new Error("caída"))) });
    expect((await preguntar("fútbol mañana a las 7", deps({ fuente: sinGrilla }))).texto).toMatch(/^No pude revisar los horarios/);
    // si solo falla un local, se muestran los demás
    const unaFalla = fuenteFalsa({ local: jest.fn(async (slug: string) => (slug === "la-canchita" ? Promise.reject(new Error("x")) : local(slug))) });
    expect((await preguntar("fútbol mañana a las 8", deps({ fuente: unaFalla }))).recomendaciones.map((x) => x.slug)).toEqual(["los-andes"]);
    // un local que ya no está publicado se salta
    const despublicado = fuenteFalsa({ local: jest.fn(async (slug: string) => (slug === "la-canchita" ? null : local(slug))) });
    expect((await preguntar("fútbol mañana a las 8", deps({ fuente: despublicado }))).recomendaciones.map((x) => x.slug)).toEqual(["los-andes"]);
  });

  it("valida el mensaje", async () => {
    await expect(preguntar("")).rejects.toMatchObject({ codigo: "DATOS_INVALIDOS_ASISTENTE" });
  });
});

describe("con IA", () => {
  const interpIA: Interpretacion = {
    intencion: "buscar",
    respuesta: null,
    seguro: true,
    filtros: { ...SIN_FILTROS, deporte: "Fútbol", distrito: "Carmen Alto", hora: "20:00" },
  };
  const LIBRE = "necesito algo para el cumpleaños de mi primo con varios amigos que juegan bien y quieren jugar";

  it("si las reglas están seguras, no gasta IA", async () => {
    const ia = iaFalsa(interpIA);
    await preguntar("fútbol mañana a las 7", deps({ ia }));
    expect(ia.control.cupo).not.toHaveBeenCalled();
    expect(ia.interprete.interpretar).not.toHaveBeenCalled();
  });

  it("si no están seguras, pregunta a la IA, completa el día y registra el uso", async () => {
    const ia = iaFalsa(interpIA);
    const historial = [{ rol: "persona", texto: "hola" }];
    const r = await preguntar(LIBRE, deps({ ia }), { historial });
    expect(r.modo).toBe("ia");
    expect(r.aviso).toBeNull();
    expect(r.filtros.fecha).toBe("2026-11-22"); // 20:00 todavía no pasó: hoy
    expect(r.recomendaciones.length).toBeGreaterThan(0);
    expect(ia.interprete.interpretar).toHaveBeenCalledWith({
      mensaje: LIBRE,
      historial,
      filtrosPrevios: SIN_FILTROS,
      hoy: "2026-11-22",
      horaAhora: "10:30",
      config: CONFIG,
    });
    expect(ia.control.registrar).toHaveBeenCalledWith(REGISTRO);
  });

  it("la IA también responde dudas y temas fuera de lugar", async () => {
    const duda = iaFalsa({ intencion: "duda", respuesta: "Sí, puedes pagar con Plin.", filtros: SIN_FILTROS, seguro: true });
    expect((await preguntar("¿qué pasa si no pago a tiempo?", deps({ ia: duda }))).texto).toBe("Sí, puedes pagar con Plin.");
    const otro = iaFalsa({ intencion: "otro", respuesta: "Solo ayudo con canchas.", filtros: SIN_FILTROS, seguro: true });
    const r = await preguntar("cuéntame un chiste", deps({ ia: otro }));
    expect(r).toEqual(expect.objectContaining({ texto: "Solo ayudo con canchas.", modo: "ia" }));
    const saludo = iaFalsa({ intencion: "saludo", respuesta: "¡Hola, crack!", filtros: SIN_FILTROS, seguro: true });
    expect((await preguntar("qué tal, buenas noches a todos los del grupo", deps({ ia: saludo }))).texto).toBe("¡Hola, crack!");
  });

  it("sin cupo, responde con las reglas y explica por qué", async () => {
    const casos: [Cupo["motivo"], RegExp][] = [
      ["SIN_SESION", /Si inicias sesión/],
      ["CUPO_CUENTA", /Ya usaste tus 10 consultas/],
      ["CUPO_DIA", /llegó a su límite de hoy/],
    ];
    for (const [motivo, aviso] of casos) {
      const ia = iaFalsa(interpIA, { permitido: false, motivo, limiteCuenta: 10 });
      const r = await preguntar("cuéntame un chiste", deps({ ia }));
      expect(r.modo).toBe("reglas");
      expect(r.aviso).toMatch(aviso);
      expect(ia.interprete.interpretar).not.toHaveBeenCalled();
    }
  });

  it("si la IA falla, responde igual con las reglas", async () => {
    const sinRespuesta = iaFalsa(null);
    const r = await preguntar("cuéntame un chiste", deps({ ia: sinRespuesta }));
    expect(r).toEqual(expect.objectContaining({ modo: "reglas", texto: NO_ENTENDI, aviso: "La IA no respondió esta vez. Te respondo con lo que entendí." }));
    expect(sinRespuesta.control.registrar).toHaveBeenCalled(); // el intento fallido también se registra

    const explota = iaFalsa(interpIA);
    explota.interprete.interpretar.mockRejectedValueOnce(new Error("red"));
    expect((await preguntar("cuéntame un chiste", deps({ ia: explota }))).modo).toBe("reglas");
    expect(explota.control.registrar).not.toHaveBeenCalled();

    const registroFalla = iaFalsa(interpIA);
    registroFalla.control.registrar.mockRejectedValueOnce(new Error("bd"));
    expect((await preguntar(LIBRE, deps({ ia: registroFalla }))).modo).toBe("ia");
  });

  it("sin configuración del modelo o si falla el cupo, no llama a la IA", async () => {
    const sinConfig = iaFalsa(interpIA);
    sinConfig.control.config.mockResolvedValueOnce(null);
    const r = await preguntar("cuéntame un chiste", deps({ ia: sinConfig }));
    expect(r.aviso).toBeNull();
    expect(sinConfig.interprete.interpretar).not.toHaveBeenCalled();

    const cupoFalla = iaFalsa(interpIA);
    cupoFalla.control.cupo.mockRejectedValueOnce(new Error("bd"));
    expect((await preguntar("cuéntame un chiste", deps({ ia: cupoFalla }))).modo).toBe("reglas");
    expect(cupoFalla.interprete.interpretar).not.toHaveBeenCalled();
  });
});
