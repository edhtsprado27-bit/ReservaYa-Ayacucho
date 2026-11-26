// Intérprete por reglas del asistente: lo común se entiende sin IA.
// Fecha fija: domingo 22 de noviembre de 2026, 10:30 en Ayacucho.
import { SIN_FILTROS, type Filtros } from "@/modules/asistente/dominio/asistente";
import { interpretarConReglas, prepararTexto, reconocerLocal } from "@/modules/asistente/dominio/interprete-reglas";

const LOCALES = ["Complejo Los Andes", "La Canchita del Barrio", "Grass Pendiente"];
const ctx = { hoy: "2026-11-22", horaAhora: "10:30", previos: SIN_FILTROS, locales: LOCALES };
const leer = (m: string, previos: Filtros = SIN_FILTROS, horaAhora = "10:30") => interpretarConReglas(m, { ...ctx, previos, horaAhora });
const filtros = (m: string, previos?: Filtros) => leer(m, previos).filtros;

describe("prepararTexto y reconocerLocal", () => {
  it("quita tildes, signos y espacios de más", () => {
    expect(prepararTexto("¿Fútbol   en Cáceres, mañana?")).toBe(" ¿futbol en caceres manana? ");
  });
  it("reconoce un local por sus palabras distintivas", () => {
    expect(reconocerLocal(prepararTexto("algo en los andes"), LOCALES)).toBe("Complejo Los Andes");
    expect(reconocerLocal(prepararTexto("la canchita del barrio"), LOCALES)).toBe("La Canchita del Barrio");
    expect(reconocerLocal(prepararTexto("una cancha cualquiera"), LOCALES)).toBeNull();
  });
});

describe("búsquedas", () => {
  it("deporte, distrito, día y hora (un partido «a las 7» es de noche)", () => {
    const r = leer("fútbol en Carmen Alto mañana a las 7");
    expect(r).toEqual(expect.objectContaining({ intencion: "buscar", seguro: true, nota: null }));
    expect(r.filtros).toEqual({ ...SIN_FILTROS, distrito: "Carmen Alto", deporte: "Fútbol", fecha: "2026-11-23", hora: "19:00" });
  });

  it("distritos por su apodo", () => {
    expect(filtros("en San Juan").distrito).toBe("San Juan Bautista");
    expect(filtros("en sjb").distrito).toBe("San Juan Bautista");
    expect(filtros("por Nazareno").distrito).toBe("Jesús Nazareno");
    expect(filtros("en Cáceres").distrito).toBe("Andrés Avelino Cáceres D.");
    expect(filtros("cerca de la plaza").distrito).toBe("Ayacucho");
    expect(filtros("canchas en Ayacucho").distrito).toBeNull(); // toda la ciudad
  });

  it("deportes", () => {
    expect(filtros("una pichanga").deporte).toBe("Fútbol");
    expect(filtros("fulbito").deporte).toBe("Fútbol");
    expect(filtros("futbol sala").deporte).toBe("Futsal");
    expect(filtros("voleibol").deporte).toBe("Vóley");
  });

  it("servicios, techo y precio", () => {
    expect(filtros("con duchas, vestuarios y donde dejar el carro").servicios).toEqual(["vestuarios", "duchas", "estacionamiento"]);
    expect(filtros("que tenga kiosko, tribuna, luces y balón").servicios).toEqual(["cafeteria", "tribuna", "iluminacion", "balon_incluido"]);
    expect(filtros("cancha techada por si llueve").techada).toBe(true);
    expect(filtros("al aire libre").techada).toBe(false);
    expect(filtros("menos de 50 soles").precioMax).toBe(50);
    expect(filtros("hasta s/ 70").precioMax).toBe(70);
  });

  it("días: hoy, mañana, pasado mañana, días de la semana, fin de semana y fechas", () => {
    expect(filtros("hoy").fecha).toBe("2026-11-22");
    expect(filtros("pasado mañana").fecha).toBe("2026-11-24");
    expect(filtros("el sábado").fecha).toBe("2026-11-28");
    expect(filtros("el domingo").fecha).toBe("2026-11-22"); // hoy es domingo
    expect(filtros("el lunes").fecha).toBe("2026-11-23");
    expect(filtros("el finde").fecha).toBe("2026-11-22");
    expect(filtros("el 28/11").fecha).toBe("2026-11-28");
    expect(filtros("el 3 de diciembre").fecha).toBe("2026-12-03");
    expect(filtros("el 2").fecha).toBe("2026-12-02"); // el 2 ya pasó este mes: es el de diciembre
    expect(filtros("el 99").fecha).toBeNull();
  });

  it("una fecha muy lejana se avisa", () => {
    const r = leer("el 15 de diciembre");
    expect(r.filtros.fecha).toBeNull();
    expect(r.intencion).toBe("buscar");
    expect(r.nota).toBe("Solo se puede reservar hasta el sábado 5 de diciembre.");
  });

  it("horas: am/pm, «y media», 24 h, mediodía y fuera del horario", () => {
    expect(filtros("a las 7 de la mañana").hora).toBe("07:00");
    expect(filtros("a las 7 de la noche").hora).toBe("19:00");
    expect(filtros("8pm").hora).toBe("20:00");
    expect(filtros("9 am").hora).toBe("09:00");
    expect(filtros("a las 6 y media").hora).toBe("18:30");
    expect(filtros("a las 21:00").hora).toBe("21:00");
    expect(filtros("7:30").hora).toBe("19:30");
    expect(filtros("a las 11").hora).toBe("11:00");
    expect(filtros("al mediodía").hora).toBe("12:00");
    expect(filtros("a las 18 hrs").hora).toBe("18:00");
    const tarde = leer("a las 2 de la mañana");
    expect(tarde.filtros.hora).toBeNull();
    expect(tarde.nota).toMatch(/06:00 a 23:00/);
  });

  it("una hora sin día es hoy si todavía no pasó; si ya pasó, mañana", () => {
    expect(filtros("a las 8 de la mañana").fecha).toBe("2026-11-23");
    expect(filtros("a las 8 pm").fecha).toBe("2026-11-22");
  });

  it("franjas cuando no hay hora exacta", () => {
    expect(filtros("el sábado en la noche")).toEqual(expect.objectContaining({ fecha: "2026-11-28", franja: "noche", hora: null }));
    expect(filtros("mañana en la mañana")).toEqual(expect.objectContaining({ fecha: "2026-11-23", franja: "manana" }));
    expect(filtros("esta tarde")).toEqual(expect.objectContaining({ fecha: "2026-11-22", franja: "tarde" }));
  });

  it("un local por su nombre", () => {
    expect(leer("Los Andes hoy a las 8 pm").filtros).toEqual(expect.objectContaining({ nombre: "Complejo Los Andes", hora: "20:00" }));
  });

  it("«quiero jugar» sin datos también es búsqueda", () => {
    expect(leer("quiero jugar")).toEqual(expect.objectContaining({ intencion: "buscar", seguro: true }));
  });
});

describe("seguimiento de la conversación", () => {
  const previos = filtros("fútbol en Carmen Alto mañana a las 7 con duchas");

  it("solo cambia lo que se dice", () => {
    expect(filtros("¿y a las 8?", previos)).toEqual({ ...previos, hora: "20:00" });
    expect(filtros("y el sábado", previos)).toEqual({ ...previos, fecha: "2026-11-28" });
    expect(filtros("el sábado a las 8", previos)).toEqual({ ...previos, fecha: "2026-11-28", hora: "20:00" });
    expect(filtros("una hora más tarde", previos).hora).toBe("20:00");
    expect(filtros("más temprano", previos).hora).toBe("18:00");
    expect(filtros("en la noche", previos)).toEqual({ ...previos, hora: null, franja: "noche" });
    expect(filtros("también con estacionamiento", previos).servicios).toEqual(["duchas", "estacionamiento"]);
  });

  it("«sin duchas» y «en cualquier distrito» ajustan la búsqueda anterior", () => {
    const sin = leer("sin duchas", previos);
    expect(sin).toEqual(expect.objectContaining({ intencion: "buscar", seguro: true }));
    expect(sin.filtros.servicios).toEqual([]);
    expect(filtros("en cualquier distrito", previos)).toEqual({ ...previos, distrito: null });
  });

  it("una búsqueda distinta empieza de cero", () => {
    expect(filtros("vóley en San Juan", previos)).toEqual({ ...SIN_FILTROS, deporte: "Vóley", distrito: "San Juan Bautista" });
  });
});

describe("saludos y dudas", () => {
  it("saludos y agradecimientos", () => {
    expect(leer("Hola")).toEqual(expect.objectContaining({ intencion: "saludo", respuesta: null, seguro: true }));
    expect(leer("¡gracias!")).toEqual(expect.objectContaining({ intencion: "saludo", seguro: true }));
    expect(leer("gracias")?.respuesta).toMatch(/De nada/);
  });

  it("dudas conocidas", () => {
    const pago = leer("¿Cómo pago el adelanto?");
    expect(pago).toEqual(expect.objectContaining({ intencion: "duda", seguro: true }));
    expect(pago.respuesta).toMatch(/Yape o Plin/);
    expect(leer("¿puedo cancelar mi reserva?").respuesta).toMatch(/Mis reservas/);
    expect(leer("olvidé mi contraseña").respuesta).toMatch(/Olvidaste tu contraseña/);
  });

  it("si dos temas empatan, responde los dos pero pide ayuda a la IA", () => {
    const r = leer("¿qué pasa si no pago a tiempo?");
    expect(r.intencion).toBe("duda");
    expect(r.seguro).toBe(false);
    expect(r.respuesta).toMatch(/adelanto/);
    expect(r.respuesta).toMatch(/se libera sola/);
  });

  it("«¿cuánto cuesta en Los Andes?» muestra el local con su precio", () => {
    expect(leer("¿Cuánto cuesta en Los Andes?")).toEqual(expect.objectContaining({ intencion: "buscar" }));
  });

  it("lo que no entiende no es seguro (se le pregunta a la IA)", () => {
    expect(leer("cuéntame un chiste")).toEqual(expect.objectContaining({ intencion: "otro", seguro: false }));
    expect(leer("necesito algo bonito para el cumpleaños de mi primo con varios amigos que juegan bien y quieren jugar")).toEqual(
      expect.objectContaining({ intencion: "buscar", seguro: false }),
    );
  });
});
