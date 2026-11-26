// Caso de uso del asistente (RF09, HU08). Capa: aplicación.
//
// 1. Las reglas intentan entender el mensaje (rápido y sin gastar IA).
// 2. Si no están seguras y hay cupo, se le pregunta a la IA (OpenRouter).
//    Si la IA falla o no hay cupo, se responde con lo que entendieron las reglas.
// 3. Para buscar, se usan los datos REALES: catálogo publicado y grilla de
//    horarios de cada local. La IA nunca decide qué locales ni qué horas hay.

import type { CanchaBD } from "@/modules/catalogo/dominio/cancha";
import { nombreServicio } from "@/modules/catalogo/dominio/servicios";
import { fechaLima, horaLima } from "@/modules/reservas/dominio/tiempo";
import {
  completarFecha,
  entendido,
  validarPedidoAsistente,
  type Filtros,
  type Interpretacion,
  type PedidoAsistente,
  type Recomendacion,
  type RespuestaAsistente,
} from "../dominio/asistente";
import type { Cupo, FuenteCanchas, ServicioIA } from "../dominio/asistente.puertos";
import {
  evaluarLocal,
  filtrarCatalogo,
  MAX_LOCALES_A_REVISAR,
  MAX_RECOMENDACIONES,
  ordenarRecomendaciones,
  redactarBusqueda,
  sinHoras,
} from "../dominio/busqueda";
import { PREGUNTAS_FRECUENTES } from "../dominio/conocimiento";
import { interpretarConReglas } from "../dominio/interprete-reglas";

export type DepsAsistente = { fuente: FuenteCanchas; ia: ServicioIA | null; ahora: Date };

export const SALUDO =
  "¡Hola! Soy el asistente de ReservaYa. Dime qué quieres jugar, dónde y cuándo (por ejemplo «fútbol en Carmen Alto mañana a las 7») " +
  "y te muestro las canchas con esa hora libre. También respondo dudas sobre reservas y pagos.";

export const NO_ENTENDI =
  "No te entendí bien. Dime el deporte, el distrito, el día y la hora (por ejemplo «vóley en San Juan el sábado en la noche») " +
  "o pregúntame cómo reservar, pagar o cancelar.";

export const SUGERENCIAS_INICIO = ["Fútbol hoy en la noche", "Canchas con duchas en Carmen Alto", "¿Cómo pago el adelanto?"];

function avisoCupo(c: Cupo | null): string | null {
  if (!c) return null;
  if (c.motivo === "SIN_SESION") return "Si inicias sesión, la IA entiende preguntas más libres. Por ahora te respondo con lo que entendí.";
  if (c.motivo === "CUPO_CUENTA") return `Ya usaste tus ${c.limiteCuenta} consultas con IA de hoy (mañana se renuevan). Te respondo con lo que entendí.`;
  if (c.motivo === "CUPO_DIA") return "La IA ya llegó a su límite de hoy. Te respondo con lo que entendí.";
  return null;
}

async function preguntarALaIA(ia: ServicioIA | null, p: PedidoAsistente, hoy: string, horaAhora: string) {
  if (!ia) return { interpretacion: null, aviso: null };
  const cupo = await ia.control.cupo().catch(() => null);
  if (!cupo?.permitido) return { interpretacion: null, aviso: avisoCupo(cupo) };
  const config = await ia.control.config().catch(() => null);
  if (!config) return { interpretacion: null, aviso: null };

  const r = await ia.interprete
    .interpretar({ mensaje: p.mensaje, historial: p.historial, filtrosPrevios: p.filtros, hoy, horaAhora, config })
    .catch(() => ({ interpretacion: null, ia: null }));
  if (r.ia) await ia.control.registrar(r.ia).catch(() => undefined); // el registro nunca frena la respuesta
  return {
    interpretacion: r.interpretacion,
    aviso: r.interpretacion ? null : "La IA no respondió esta vez. Te respondo con lo que entendí.",
  };
}

async function buscar(fuente: FuenteCanchas, catalogo: CanchaBD[] | null, f: Filtros, hoy: string) {
  if (!catalogo) return { texto: "No pude consultar las canchas en este momento. Intenta de nuevo en un rato.", recomendaciones: [] };
  const candidatos = filtrarCatalogo(catalogo, f);
  if (!f.fecha) {
    const recomendaciones = candidatos.slice(0, MAX_RECOMENDACIONES).map(sinHoras);
    return { texto: redactarBusqueda(f, hoy, candidatos.length, recomendaciones), recomendaciones };
  }
  const fecha = f.fecha;
  const revisar = candidatos.slice(0, MAX_LOCALES_A_REVISAR);
  let fallos = 0;
  const evaluados = await Promise.all(
    revisar.map(async (c): Promise<Recomendacion | null> => {
      try {
        const local = await fuente.local(c.slug);
        if (!local) return null;
        return evaluarLocal(c, local, await fuente.turnos(local.id, fecha), { ...f, fecha });
      } catch {
        fallos++;
        return null;
      }
    }),
  );
  if (revisar.length && fallos === revisar.length) {
    return { texto: "No pude revisar los horarios en este momento. Intenta de nuevo en un rato.", recomendaciones: [] };
  }
  const recomendaciones = ordenarRecomendaciones(evaluados.filter((r): r is Recomendacion => r !== null)).slice(0, MAX_RECOMENDACIONES);
  return { texto: redactarBusqueda(f, hoy, candidatos.length, recomendaciones), recomendaciones };
}

function sugerenciasBusqueda(f: Filtros, encontrados: boolean): string[] {
  const s: string[] = [];
  if (!f.fecha) return ["Hoy en la noche", "Mañana a las 19:00"];
  if (!encontrados) {
    if (f.servicios.length) s.push(`Sin ${nombreServicio(f.servicios[0]).toLowerCase()}`);
    if (f.distrito) s.push("En cualquier distrito");
    s.push(f.hora ? "Una hora más tarde" : "Mañana");
  } else {
    if (f.hora) s.push("Una hora más tarde");
    s.push("¿Cómo pago el adelanto?");
  }
  return s.slice(0, 3);
}

/** Responde un mensaje del chat */
export async function consultarAsistente(deps: DepsAsistente, datos: unknown): Promise<RespuestaAsistente> {
  const hoy = fechaLima(deps.ahora);
  const horaAhora = horaLima(deps.ahora);
  const pedido = validarPedidoAsistente(datos, hoy);
  const catalogo = await deps.fuente.publicadas().catch(() => null);

  const reglas = interpretarConReglas(pedido.mensaje, {
    hoy,
    horaAhora,
    previos: pedido.filtros,
    locales: (catalogo ?? []).map((c) => c.nombre),
  });
  let interp: Interpretacion = reglas;
  let modo: RespuestaAsistente["modo"] = "reglas";
  let aviso = reglas.nota;
  if (!reglas.seguro) {
    const r = await preguntarALaIA(deps.ia, pedido, hoy, horaAhora);
    if (r.interpretacion) {
      interp = { ...r.interpretacion, filtros: completarFecha(r.interpretacion.filtros, hoy, horaAhora) };
      modo = "ia";
      aviso = null;
    } else {
      aviso = r.aviso ?? aviso;
    }
  }

  const comun = { modo, aviso, filtros: interp.filtros };
  switch (interp.intencion) {
    case "saludo":
      return { ...comun, texto: interp.respuesta ?? SALUDO, entendido: [], recomendaciones: [], sugerencias: SUGERENCIAS_INICIO };
    case "duda": {
      const otras = PREGUNTAS_FRECUENTES.filter((t) => !interp.respuesta?.includes(t.respuesta)).map((t) => t.pregunta);
      return {
        ...comun,
        texto: interp.respuesta ?? NO_ENTENDI,
        entendido: [],
        recomendaciones: [],
        sugerencias: ["Fútbol hoy en la noche", ...otras.slice(0, 2)],
      };
    }
    case "otro":
      return { ...comun, texto: interp.respuesta ?? NO_ENTENDI, entendido: [], recomendaciones: [], sugerencias: SUGERENCIAS_INICIO };
    case "buscar": {
      const { texto, recomendaciones } = await buscar(deps.fuente, catalogo, interp.filtros, hoy);
      return {
        ...comun,
        texto,
        entendido: entendido(interp.filtros),
        recomendaciones,
        sugerencias: sugerenciasBusqueda(interp.filtros, recomendaciones.length > 0),
      };
    }
  }
}
