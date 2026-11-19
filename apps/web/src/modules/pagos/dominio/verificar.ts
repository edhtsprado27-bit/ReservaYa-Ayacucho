// Reglas para revisar lo que la IA leyó de un comprobante de Yape o Plin.
// Capa: dominio.
// Son funciones puras (sin red ni base de datos): se prueban con pruebas unitarias.

const sinTildes = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");

/** "  Juan  Pérez*** " -> ["juan", "perez"] (sin tildes, asteriscos ni puntos) */
export function palabrasDeNombre(nombre: string): string[] {
  return sinTildes(nombre)
    .toLowerCase()
    .replace(/[^a-zñ\s]/g, " ")
    .split(/\s+/)
    .filter((p) => p.length >= 2);
}

/**
 * ¿El destinatario que se ve en la captura es el titular del local?
 * Yape y Plin suelen mostrar el nombre abreviado o con asteriscos
 * ("Juan Pér***", "Juan P. Quispe"). Coincide si el primer nombre es el
 * mismo y alguna otra palabra empieza igual (con al menos 1 letra visible).
 * Devuelve null si falta alguno de los dos nombres (no se puede comparar).
 */
export function destinatarioCoincide(leido: string | null | undefined, titular: string | null | undefined): boolean | null {
  if (!leido || !titular) return null;
  const a = palabrasDeNombre(leido);
  const b = palabrasDeNombre(titular);
  if (!a.length || !b.length) return null;
  const empiezaIgual = (x: string, y: string) => x.startsWith(y) || y.startsWith(x);
  const primerNombre = a.some((x) => x.length >= 3 && empiezaIgual(x, b[0])) || b.some((y) => y.length >= 3 && empiezaIgual(y, a[0]));
  if (!primerNombre) return false;
  if (a.length === 1 || b.length === 1) return true; // solo se ve un nombre
  const resto = a.slice(1);
  return resto.some((x) => b.slice(1).some((y) => empiezaIgual(x, y)));
}

/**
 * Fecha que devuelve la IA ("2026-11-18T19:15", hora de Perú) -> ISO con zona.
 * Si viene con zona, se respeta. Devuelve null si no se entiende.
 */
export function fechaLeidaAISO(fecha: string | null | undefined): string | null {
  if (!fecha) return null;
  const t = fecha.trim().replace(" ", "T");
  const conZona = /([zZ]|[+-]\d{2}:?\d{2})$/.test(t);
  const m = t.match(/^(\d{4}-\d{2}-\d{2})(?:T(\d{2}:\d{2})(?::\d{2})?)?/);
  if (!m) return null;
  const iso = conZona ? t : `${m[1]}T${m[2] ?? "12:00"}:00-05:00`;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** "N° 0012-3456" -> "00123456"; null si no parece un número de operación */
export function operacionLimpia(op: string | null | undefined): string | null {
  const d = (op ?? "").replace(/\D/g, "");
  return d.length >= 4 && d.length <= 30 ? d : null;
}

/** "S/ 40.00", "40,5" o 40 -> 40 / 40.5; null si no es un monto válido */
export function montoLimpio(m: unknown): number | null {
  if (typeof m === "number") return Number.isFinite(m) && m > 0 && m < 100000 ? Math.round(m * 100) / 100 : null;
  if (typeof m !== "string") return null;
  const n = Number(m.replace(/[^\d.,]/g, "").replace(",", "."));
  return montoLimpio(Number.isFinite(n) ? n : null);
}

export type LecturaIA = {
  es_comprobante: boolean;
  app: "yape" | "plin" | "otro" | null;
  monto: number | null;
  numero_operacion: string | null;
  fecha_hora: string | null;
  destinatario: string | null;
  confianza: number;
};

/** Acepta la respuesta de la IA solo si tiene la forma esperada (nunca confiar a ciegas) */
export function validarLectura(x: unknown): LecturaIA | null {
  if (!x || typeof x !== "object") return null;
  const o = x as Record<string, unknown>;
  if (typeof o.es_comprobante !== "boolean") return null;
  const app = typeof o.app === "string" ? o.app.toLowerCase() : null;
  const texto = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
  const confianza = typeof o.confianza === "number" && Number.isFinite(o.confianza) ? Math.min(1, Math.max(0, o.confianza)) : 0;
  return {
    es_comprobante: o.es_comprobante,
    app: app === "yape" || app === "plin" ? app : app ? "otro" : null,
    monto: montoLimpio(o.monto),
    numero_operacion: texto(o.numero_operacion, 40),
    fecha_hora: texto(o.fecha_hora, 40),
    destinatario: texto(o.destinatario, 120),
    confianza,
  };
}

/** Texto de la IA -> objeto. Algunos modelos envuelven el JSON en ```json ... ``` */
export function extraerJSON(texto: string): unknown {
  const limpio = texto.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    return JSON.parse(limpio);
  } catch {
    const i = limpio.indexOf("{");
    const j = limpio.lastIndexOf("}");
    if (i >= 0 && j > i) {
      try {
        return JSON.parse(limpio.slice(i, j + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}
