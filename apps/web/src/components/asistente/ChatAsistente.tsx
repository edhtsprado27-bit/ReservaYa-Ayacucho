"use client";

// Chat del asistente (RF09, HU08). Escribe lo que buscas ("fútbol en Carmen
// Alto mañana a las 7") o una duda ("¿cómo pago el adelanto?"). Las canchas y
// horas que muestra salen de la base de datos; cada hora lleva directo a la
// grilla con esa hora elegida. La conversación se guarda en esta pestaña
// (sessionStorage) para que no se pierda al ir a una ficha y volver.

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { Filtros, RespuestaAsistente } from "@/modules/asistente/dominio/asistente";
import { nombreServicio } from "@/modules/catalogo/dominio/servicios";
import { llamarApi } from "@/modules/compartido/presentacion/llamar-api";

type Mensaje = { id: number; rol: "persona" | "asistente"; texto: string; respuesta?: RespuestaAsistente; error?: boolean };

const CLAVE = "reservaya-asistente-v1";
const MAX_GUARDADOS = 30;
const BIENVENIDA: Mensaje = {
  id: 0,
  rol: "asistente",
  texto:
    "¡Hola! Dime qué quieres jugar, dónde y cuándo, y te muestro las canchas con esa hora libre. También respondo dudas sobre reservas y pagos.",
  respuesta: {
    texto: "",
    modo: "reglas",
    aviso: null,
    filtros: null as unknown as Filtros,
    entendido: [],
    recomendaciones: [],
    sugerencias: ["Fútbol hoy en la noche", "Canchas con duchas en Carmen Alto", "¿Cómo pago el adelanto?"],
  },
};

function leerGuardados(): Mensaje[] {
  try {
    const guardado = JSON.parse(sessionStorage.getItem(CLAVE) ?? "null");
    return Array.isArray(guardado) && guardado.length ? (guardado as Mensaje[]) : [BIENVENIDA];
  } catch {
    return [BIENVENIDA];
  }
}

function guardar(mensajes: Mensaje[]) {
  try {
    sessionStorage.setItem(CLAVE, JSON.stringify(mensajes.slice(-MAX_GUARDADOS)));
  } catch {
    /* modo privado o sin espacio: el chat funciona igual */
  }
}

const soles = (n: number) => `S/ ${Number.isInteger(n) ? n : n.toFixed(2)}`;

export default function ChatAsistente({ conSesion }: { conSesion: boolean }) {
  const [mensajes, setMensajes] = useState<Mensaje[]>(leerGuardados);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const final = useRef<HTMLDivElement>(null);
  const entrada = useRef<HTMLInputElement>(null);

  useEffect(() => {
    guardar(mensajes);
    final.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [mensajes]);

  async function enviar(mensaje: string) {
    const limpio = mensaje.trim();
    if (!limpio || enviando) return;
    const anteriores = mensajes.filter((m) => m.id !== 0 && !m.error);
    const filtros = [...anteriores].reverse().find((m) => m.respuesta?.filtros)?.respuesta?.filtros ?? null;
    const historial = anteriores.slice(-6).map((m) => ({ rol: m.rol, texto: m.texto }));
    const id = Math.max(0, ...mensajes.map((m) => m.id)) + 1;
    setMensajes((ms) => [...ms, { id, rol: "persona", texto: limpio }]);
    setTexto("");
    setEnviando(true);
    const r = await llamarApi<{ respuesta: RespuestaAsistente }>("/api/asistente", "POST", { mensaje: limpio, filtros, historial });
    setEnviando(false);
    setMensajes((ms) => [
      ...ms,
      r.ok
        ? { id: id + 1, rol: "asistente", texto: r.datos.respuesta.texto, respuesta: r.datos.respuesta }
        : { id: id + 1, rol: "asistente", texto: r.error, error: true },
    ]);
    entrada.current?.focus();
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void enviar(texto);
  }

  function reiniciar() {
    setMensajes([BIENVENIDA]);
    setTexto("");
    entrada.current?.focus();
  }

  const ultimo = mensajes.at(-1);

  return (
    <section className="chat" aria-label="Chat con el asistente">
      <div className="chat-mensajes" role="log" aria-live="polite" aria-relevant="additions">
        {mensajes.map((m) => (
          <div key={m.id} className={`chat-fila chat-fila--${m.rol}`}>
            <div className={`chat-burbuja chat-burbuja--${m.rol}${m.error ? " chat-burbuja--error" : ""}`}>
              {m.rol === "asistente" && m.respuesta?.modo === "ia" && (
                <span className="chat-ia" title="La IA interpretó tu mensaje; los datos son de ReservaYa">
                  Respondido con IA
                </span>
              )}
              <p>{m.texto}</p>
              {m.respuesta && m.respuesta.entendido.length > 0 && (
                <p className="chat-entendido">
                  <span>Entendí:</span>
                  {m.respuesta.entendido.map((e) => (
                    <span key={e} className="chip-mini">
                      {e}
                    </span>
                  ))}
                </p>
              )}
              {m.respuesta && m.respuesta.recomendaciones.length > 0 && (
                <ul className="chat-locales">
                  {m.respuesta.recomendaciones.map((r) => (
                    <li key={r.slug} className="chat-local">
                      <Link href={r.enlace} className="chat-local-nombre">
                        {r.nombre}
                      </Link>
                      <span className="meta">
                        {r.distrito}
                        {r.precioDesde ? ` · desde ${soles(r.precioDesde)}/h` : ""}
                        {r.deportes.length ? ` · ${r.deportes.join(", ")}` : ""}
                      </span>
                      {r.servicios.length > 0 && (
                        <span className="servicios servicios--chicos">
                          {r.servicios.map((s) => (
                            <span key={s}>{nombreServicio(s)}</span>
                          ))}
                        </span>
                      )}
                      {r.horas.length > 0 ? (
                        <span className="chat-horas" role="group" aria-label={`Horas libres en ${r.nombre}`}>
                          {r.horas.map((h) => (
                            <Link
                              key={h.hora}
                              href={h.enlace}
                              className={`chat-hora${h.hora === m.respuesta?.filtros.hora ? " chat-hora--pedida" : ""}`}
                              aria-label={`Reservar ${r.nombre} a las ${h.hora}, ${h.cancha}`}
                            >
                              <strong>{h.hora}</strong>
                              <small>
                                {h.cancha}
                                {h.precio !== null ? ` · ${soles(h.precio)}` : ""}
                              </small>
                            </Link>
                          ))}
                        </span>
                      ) : (
                        <Link href={r.enlace} className="enlace-boton">
                          Ver horarios →
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {m.respuesta?.aviso && <p className="chat-aviso">{m.respuesta.aviso}</p>}
            </div>
          </div>
        ))}
        {enviando && (
          <div className="chat-fila chat-fila--asistente">
            <div className="chat-burbuja chat-burbuja--asistente chat-escribiendo" aria-label="El asistente está escribiendo">
              <span />
              <span />
              <span />
            </div>
          </div>
        )}
        <div ref={final} />
      </div>

      {ultimo?.rol === "asistente" && !enviando && (ultimo.respuesta?.sugerencias.length ?? 0) > 0 && (
        <div className="chips chat-sugerencias" role="group" aria-label="Sugerencias">
          {ultimo.respuesta?.sugerencias.map((s) => (
            <button key={s} type="button" className="chip" onClick={() => void enviar(s)}>
              {s}
            </button>
          ))}
        </div>
      )}

      <form className="chat-form" onSubmit={onSubmit}>
        <label htmlFor="mensaje-asistente" className="sr-only">
          Escribe tu mensaje
        </label>
        <input
          ref={entrada}
          id="mensaje-asistente"
          className="campo"
          autoComplete="off"
          maxLength={500}
          placeholder="Ej.: fútbol en Carmen Alto mañana a las 7"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
        />
        <button type="submit" className="boton boton--naranja" disabled={enviando || !texto.trim()}>
          Enviar
        </button>
      </form>
      <div className="chat-pie">
        <span className="meta">
          {conSesion
            ? "Las canchas y horas son las de ReservaYa en este momento. La IA solo ayuda a entender lo que escribes."
            : "Si inicias sesión, la IA entiende preguntas más libres. Las canchas y horas son las de ReservaYa en este momento."}
        </span>
        {mensajes.length > 1 && (
          <button type="button" className="enlace-boton" onClick={reiniciar}>
            Nueva conversación
          </button>
        )}
      </div>
    </section>
  );
}
