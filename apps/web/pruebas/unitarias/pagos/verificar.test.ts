// Reglas para revisar lo que la IA leyó de un comprobante (módulo pagos, dominio).
import {
  destinatarioCoincide,
  extraerJSON,
  fechaLeidaAISO,
  montoLimpio,
  operacionLimpia,
  palabrasDeNombre,
  validarLectura,
} from "@/modules/pagos/dominio/verificar";

describe("palabrasDeNombre", () => {
  it("quita tildes, asteriscos, puntos y palabras de una letra", () => {
    expect(palabrasDeNombre("  Juan  Pérez*** ")).toEqual(["juan", "perez"]);
    expect(palabrasDeNombre("Juan P. Quispe")).toEqual(["juan", "quispe"]);
  });
});

describe("destinatarioCoincide", () => {
  it("acepta el nombre abreviado con asteriscos que muestra Yape", () => {
    expect(destinatarioCoincide("Juan Pér***", "Juan Pérez")).toBe(true);
  });
  it("acepta cuando solo se ve el primer nombre", () => {
    expect(destinatarioCoincide("Juan", "Juan Pérez Quispe")).toBe(true);
  });
  it("rechaza un destinatario distinto", () => {
    expect(destinatarioCoincide("Pedro Quispe", "Juan Pérez")).toBe(false);
    expect(destinatarioCoincide("Juan Mendoza", "Juan Pérez")).toBe(false);
  });
  it("devuelve null si falta alguno de los nombres", () => {
    expect(destinatarioCoincide(null, "Juan Pérez")).toBeNull();
    expect(destinatarioCoincide("Juan", "")).toBeNull();
    expect(destinatarioCoincide("***", "Juan")).toBeNull();
  });
});

describe("fechaLeidaAISO", () => {
  it("interpreta la hora leída como hora de Perú (UTC-5)", () => {
    expect(fechaLeidaAISO("2026-11-18T19:15")).toBe("2026-11-19T00:15:00.000Z");
    expect(fechaLeidaAISO("2026-11-18 19:15")).toBe("2026-11-19T00:15:00.000Z");
  });
  it("usa el mediodía si solo viene la fecha", () => {
    expect(fechaLeidaAISO("2026-11-18")).toBe("2026-11-18T17:00:00.000Z");
  });
  it("respeta la zona si viene incluida", () => {
    expect(fechaLeidaAISO("2026-11-18T19:15Z")).toBe("2026-11-18T19:15:00.000Z");
  });
  it("devuelve null si no se entiende", () => {
    expect(fechaLeidaAISO("ayer")).toBeNull();
    expect(fechaLeidaAISO(null)).toBeNull();
  });
});

describe("operacionLimpia", () => {
  it("deja solo los dígitos", () => {
    expect(operacionLimpia("N° 0012-3456")).toBe("00123456");
  });
  it("rechaza números demasiado cortos o vacíos", () => {
    expect(operacionLimpia("12")).toBeNull();
    expect(operacionLimpia(undefined)).toBeNull();
  });
});

describe("montoLimpio", () => {
  it("entiende textos con S/, coma o punto", () => {
    expect(montoLimpio("S/ 40.00")).toBe(40);
    expect(montoLimpio("40,5")).toBe(40.5);
    expect(montoLimpio(60)).toBe(60);
  });
  it("rechaza montos inválidos", () => {
    expect(montoLimpio(-5)).toBeNull();
    expect(montoLimpio(0)).toBeNull();
    expect(montoLimpio(100000)).toBeNull();
    expect(montoLimpio("abc")).toBeNull();
    expect(montoLimpio(null)).toBeNull();
  });
});

describe("validarLectura (nunca confiar a ciegas en la IA)", () => {
  it("normaliza una respuesta válida", () => {
    const l = validarLectura({
      es_comprobante: true,
      app: "YAPE",
      monto: "S/ 50",
      numero_operacion: " 123456 ",
      fecha_hora: "2026-11-18T19:15",
      destinatario: "Juan Pér***",
      confianza: 1.7,
    });
    expect(l).toEqual({
      es_comprobante: true,
      app: "yape",
      monto: 50,
      numero_operacion: "123456",
      fecha_hora: "2026-11-18T19:15",
      destinatario: "Juan Pér***",
      confianza: 1,
    });
  });
  it("marca como 'otro' una app desconocida y pone confianza 0 si falta", () => {
    const l = validarLectura({ es_comprobante: false, app: "bcp" });
    expect(l?.app).toBe("otro");
    expect(l?.confianza).toBe(0);
    expect(validarLectura({ es_comprobante: false })?.app).toBeNull();
  });
  it("rechaza respuestas sin la forma esperada", () => {
    expect(validarLectura(null)).toBeNull();
    expect(validarLectura("texto")).toBeNull();
    expect(validarLectura({ es_comprobante: "si" })).toBeNull();
  });
});

describe("extraerJSON", () => {
  it("lee JSON envuelto en ```json", () => {
    expect(extraerJSON('```json\n{"a":1}\n```')).toEqual({ a: 1 });
  });
  it("encuentra el JSON dentro de texto", () => {
    expect(extraerJSON('Aquí va: {"a":2} listo')).toEqual({ a: 2 });
  });
  it("devuelve null si no hay JSON válido", () => {
    expect(extraerJSON("nada")).toBeNull();
    expect(extraerJSON("x {malo} y")).toBeNull();
  });
});
