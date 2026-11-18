"use client";

// Grilla para reservar: elige cancha, día y horas seguidas.
// Al pulsar "Reservar", el horario queda apartado mientras pagas el adelanto.
// La grilla se actualiza sola cada 30 s; si alguien gana el horario por
// segundos, la base de datos lo impide y aquí se avisa y se recarga.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  diasParaElegir,
  esActiva,
  fechaLarga,
  horaLima,
  minutosTexto,
  nuevaClave,
  soles,
  type LocalPublico,
  type Reserva,
  type Turno,
} from "@/lib/reservas";

type Inicial = { fecha?: string; cancha?: string; desde?: string; hasta?: string };
type Props = { local: LocalPublico; conSesion: boolean; hoy: string; inicial?: Inicial };
type Seleccion = { desde: number; hasta: number } | null; // milisegundos

const ms = (iso: string) => new Date(iso).getTime();
const HORA = /^\d{2}:\d{2}$/;
const REFRESCO_MS = 30_000;

// Selección que llega en la dirección (al volver del login)
function seleccionInicial(fecha: string, i?: Inicial): Seleccion {
  if (!i?.desde || !i?.hasta || !HORA.test(i.desde) || !HORA.test(i.hasta)) return null;
  const desde = Date.parse(`${fecha}T${i.desde}:00-05:00`);
  const hasta = Date.parse(`${fecha}T${i.hasta}:00-05:00`);
  return Number.isFinite(desde) && Number.isFinite(hasta) && hasta > desde ? { desde, hasta } : null;
}

export default function ReservaCancha({ local, conSesion, hoy, inicial }: Props) {
  const router = useRouter();
  const dias = useMemo(() => diasParaElegir(hoy), [hoy]);
  const fechaDeInicio = inicial?.fecha && dias.some((d) => d.fecha === inicial.fecha) ? inicial.fecha : hoy;
  const canchaDeInicio = local.canchas.find((c) => c.id === inicial?.cancha)?.id ?? local.canchas[0]?.id ?? "";

  const [fecha, setFecha] = useState(fechaDeInicio);
  const [canchaId, setCanchaId] = useState(canchaDeInicio);
  const [sel, setSel] = useState<Seleccion>(() => seleccionInicial(fechaDeInicio, inicial));
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [recarga, setRecarga] = useState(0);
  const [misReservas, setMisReservas] = useState<Reserva[]>([]);
  const [aviso, setAviso] = useState<string | null>(null);
  const [error, setError] = useState<{ texto: string; login?: boolean } | null>(null);
  const [enviando, setEnviando] = useState(false);

  const fresco = useRef(false); // true = saltar el caché del CDN (tras un choque)
  const clave = useRef(""); // una por intento: el doble clic o un reintento no crean dos reservas

  const cancha = local.canchas.find((c) => c.id === canchaId);

  // Grilla del día elegido
  useEffect(() => {
    let vivo = true;
    const ctrl = new AbortController();
    // Normalmente responde el CDN (guarda la grilla 5 s). Tras un choque se pide
    // una dirección distinta para saltar el caché y ver el estado real.
    const saltarCache = fresco.current;
    fresco.current = false;
    const url = `/api/disponibilidad?local=${local.id}&fecha=${fecha}${saltarCache ? `&v=${Date.now()}` : ""}`;
    fetch(url, { cache: saltarCache ? "no-store" : "default", signal: ctrl.signal })
      .then(async (res) => {
        const json = await res.json().catch(() => null);
        if (!vivo) return;
        if (!res.ok || !json) {
          setErrorCarga(json?.error ?? "No se pudieron cargar los horarios.");
        } else {
          setTurnos(json.turnos as Turno[]);
          setErrorCarga(null);
        }
        setCargando(false);
      })
      .catch(() => {
        if (!vivo) return;
        setErrorCarga("Sin conexión. Revisa tu internet y vuelve a intentar.");
        setCargando(false);
      });
    return () => {
      vivo = false;
      ctrl.abort();
    };
  }, [local.id, fecha, recarga]);

  // Se actualiza sola cada 30 s y al volver a la pestaña
  useEffect(() => {
    const refrescar = () => {
      if (document.visibilityState === "visible") setRecarga((n) => n + 1);
    };
    const t = setInterval(refrescar, REFRESCO_MS);
    document.addEventListener("visibilitychange", refrescar);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", refrescar);
    };
  }, []);

  // Tus reservas: para marcar "Tuya" en la grilla
  useEffect(() => {
    if (!conSesion) return;
    let vivo = true;
    fetch("/api/reservas", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        if (vivo && j?.ok) setMisReservas(j.reservas as Reserva[]);
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [conSesion]);

  const esTuya = (t: Turno) =>
    !!cancha &&
    misReservas.some(
      (r) =>
        esActiva(r.estado) &&
        r.slug === local.slug &&
        r.cancha === cancha.nombre &&
        ms(r.inicio) < ms(t.fin) &&
        ms(r.fin) > ms(t.inicio),
    );

  // Turnos de la cancha elegida (sin los que ya pasaron)
  const turnosCancha = turnos.filter((t) => t.cancha === canchaId && t.estado !== "pasado");
  const rango = sel ? turnosCancha.filter((t) => ms(t.inicio) >= sel.desde && ms(t.fin) <= sel.hasta) : [];
  const minutosElegidos = sel ? (sel.hasta - sel.desde) / 60_000 : 0;
  const completo = !!cancha && rango.length * cancha.minutosTurno === minutosElegidos;
  const seleccionLibre = sel !== null && completo && rango.every((t) => t.estado === "libre" && !esTuya(t));
  const seleccionPerdida = sel !== null && !cargando && !seleccionLibre;

  const total = rango.reduce((s, t) => s + (t.precio ?? 0) * ((cancha?.minutosTurno ?? 60) / 60), 0);
  const adelanto = Math.round(total * local.adelantoPct) / 100;
  const cortaDuracion = !!cancha && minutosElegidos > 0 && minutosElegidos < cancha.minMinutos;

  function elegir(s: Seleccion) {
    setSel(s);
    setAviso(null);
    setError(null);
    clave.current = ""; // otra selección = otro intento
  }

  function cambiarFecha(f: string) {
    if (f === fecha) return;
    setFecha(f);
    setTurnos([]);
    setCargando(true);
    elegir(null);
  }

  function cambiarCancha(id: string) {
    setCanchaId(id);
    elegir(null);
  }

  function tocar(t: Turno) {
    if (!cancha || t.estado !== "libre" || esTuya(t)) return;
    if (t.precio == null) {
      setAviso(
        `Esta cancha todavía no publicó su precio.${local.telefono ? ` Llama al ${local.telefono} para reservar.` : ""}`,
      );
      return;
    }
    const ini = ms(t.inicio);
    const fin = ms(t.fin);
    const max = cancha.maxMinutos * 60_000;
    if (!sel || !seleccionLibre) return elegir({ desde: ini, hasta: fin });
    if (ini === sel.desde && fin === sel.hasta) return elegir(null); // quitar la única hora
    if (ini === sel.hasta || fin === sel.desde) {
      // hora pegada: se suma
      const nueva = { desde: Math.min(sel.desde, ini), hasta: Math.max(sel.hasta, fin) };
      if (nueva.hasta - nueva.desde > max) {
        setAviso(`En esta cancha se puede reservar hasta ${minutosTexto(cancha.maxMinutos)} seguidas.`);
        return;
      }
      return elegir(nueva);
    }
    if (ini === sel.desde) return elegir({ desde: fin, hasta: sel.hasta }); // quitar la primera
    if (fin === sel.hasta) return elegir({ desde: sel.desde, hasta: ini }); // quitar la última
    return elegir({ desde: ini, hasta: fin }); // empezar de nuevo
  }

  async function reservar() {
    if (!sel || !cancha || !seleccionLibre || enviando) return;
    setEnviando(true);
    setError(null);
    if (!clave.current) clave.current = nuevaClave();
    const res = await fetch("/api/reservas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        canchaId: cancha.id,
        inicio: new Date(sel.desde).toISOString(),
        fin: new Date(sel.hasta).toISOString(),
        clave: clave.current,
      }),
    }).catch(() => null);
    const json = await res?.json().catch(() => null);

    if (res?.ok && json?.ok) {
      router.push(`/reservas/${json.reserva.id}`);
      return; // el botón sigue en "Reservando…" hasta que cambie la página
    }
    setEnviando(false);
    if (!res) {
      setError({ texto: "Sin conexión. Revisa tu internet y vuelve a intentar." });
      return;
    }
    if (res.status === 401) {
      setError({ texto: "Tu sesión terminó. Vuelve a ingresar para reservar.", login: true });
      return;
    }
    if (["HORARIO_OCUPADO", "HORARIO_CERRADO", "HORARIO_PASADO"].includes(json?.codigo)) {
      setSel(null);
      fresco.current = true;
      setRecarga((n) => n + 1);
    }
    setError({ texto: json?.error ?? "No se pudo reservar. Inténtalo de nuevo." });
  }

  // Para volver aquí con la misma selección después de iniciar sesión
  const destino =
    `/cancha/${local.slug}?fecha=${fecha}&cancha=${canchaId}` +
    (sel ? `&desde=${horaLima(new Date(sel.desde))}&hasta=${horaLima(new Date(sel.hasta))}` : "");
  const enlaceLogin = `/login?next=${encodeURIComponent(destino)}`;

  if (!local.canchas.length) {
    return <p className="aviso">Este local todavía no tiene canchas habilitadas para reservar.</p>;
  }

  const diaElegido = dias.find((d) => d.fecha === fecha);

  return (
    <section className="reserva" aria-labelledby="t-reservar">
      <h2 id="t-reservar" className="reserva-titulo">Reserva tu hora</h2>

      {local.canchas.length > 1 && (
        <div className="chips" role="group" aria-label="Cancha">
          {local.canchas.map((c) => (
            <button
              key={c.id}
              type="button"
              className="chip"
              aria-pressed={c.id === canchaId}
              onClick={() => cambiarCancha(c.id)}
            >
              {c.nombre}
              {c.precioDesde != null ? ` · desde ${soles(c.precioDesde)}` : ""}
            </button>
          ))}
        </div>
      )}
      {cancha && (
        <p className="meta">
          {cancha.nombre} · {cancha.deporte}
          {cancha.techada ? " · techada" : ""} · turnos de {cancha.minutosTurno} min
        </p>
      )}

      <div className="dias" role="group" aria-label="Día">
        {dias.map((d) => (
          <button
            key={d.fecha}
            type="button"
            className="dia"
            aria-pressed={d.fecha === fecha}
            onClick={() => cambiarFecha(d.fecha)}
          >
            <span>{d.arriba}</span>
            <strong>{d.abajo}</strong>
          </button>
        ))}
      </div>

      <div className="leyenda" aria-hidden="true">
        <span><i className="punto punto--libre" /> Libre</span>
        <span><i className="punto punto--elegido" /> Elegida</span>
        <span><i className="punto punto--ocupado" /> Ocupada</span>
        {conSesion && <span><i className="punto punto--tuyo" /> Tuya</span>}
      </div>

      {errorCarga && (
        <p className="aviso aviso--error" role="alert">
          {errorCarga}{" "}
          <button type="button" className="enlace-boton" onClick={() => setRecarga((n) => n + 1)}>
            Reintentar
          </button>
        </p>
      )}

      {cargando && !turnos.length ? (
        <p className="meta">Cargando horarios…</p>
      ) : !errorCarga && turnosCancha.length === 0 ? (
        <p className="vacio">
          {fecha === hoy ? "Ya no quedan horas para hoy." : "Este día la cancha no atiende."}{" "}
          {fecha === hoy && dias[1] && (
            <button type="button" className="enlace-boton" onClick={() => cambiarFecha(dias[1].fecha)}>
              Ver mañana
            </button>
          )}
        </p>
      ) : (
        <div className={`grilla${cargando ? " grilla--cargando" : ""}`} aria-busy={cargando}>
          {turnosCancha.map((t) => {
            const tuya = esTuya(t);
            const elegido = seleccionLibre && rango.includes(t);
            const estado = tuya ? "tuyo" : elegido ? "elegido" : t.estado;
            const textoEstado =
              estado === "tuyo" ? "Tuya" : estado === "ocupado" ? "Ocupada" : estado === "cerrado" ? "Cerrada" : null;
            return (
              <button
                key={t.inicio}
                type="button"
                className={`turno turno--${estado}`}
                disabled={t.estado !== "libre" || tuya}
                aria-pressed={elegido}
                aria-label={`${horaLima(t.inicio)} a ${horaLima(t.fin)}, ${textoEstado ?? (t.precio != null ? soles(t.precio) : "precio por consultar")}`}
                onClick={() => tocar(t)}
              >
                <strong>{horaLima(t.inicio)}</strong>
                <small>{textoEstado ?? (t.precio != null ? soles(t.precio) : "Consultar")}</small>
              </button>
            );
          })}
        </div>
      )}

      {aviso && <p className="aviso" role="status">{aviso}</p>}
      {seleccionPerdida && !error && (
        <p className="aviso" role="status">
          Una de las horas que elegiste ya no está libre. Elige otra.
        </p>
      )}
      {error && (
        <p className="aviso aviso--error" role="alert">
          {error.texto} {error.login && <Link href={enlaceLogin}>Ingresar</Link>}
        </p>
      )}

      <p className="meta letra-chica">
        Al reservar, el horario queda apartado {local.minutosApartado} minutos para que pagues el adelanto (
        {local.adelantoPct}% del total). Si no se paga, se libera solo. El resto se paga en el local.
      </p>

      <div className="resumen-reserva" aria-live="polite">
        {seleccionLibre && sel ? (
          <>
            <div className="resumen-datos">
              <strong>
                {diaElegido ? `${diaElegido.arriba} ${diaElegido.abajo}` : fechaLarga(new Date(sel.desde))} ·{" "}
                {horaLima(new Date(sel.desde))} – {horaLima(new Date(sel.hasta))}
              </strong>
              <span>
                {minutosTexto(minutosElegidos)} · Total{" "}
                {soles(total)} · Adelanto {soles(adelanto)}
              </span>
            </div>
            {cortaDuracion ? (
              <span className="meta">Mínimo {minutosTexto(cancha?.minMinutos ?? 60)}</span>
            ) : conSesion ? (
              <button type="button" className="boton boton--naranja" onClick={reservar} disabled={enviando}>
                {enviando ? "Reservando…" : "Reservar"}
              </button>
            ) : (
              <Link className="boton boton--naranja" href={enlaceLogin}>
                Ingresa para reservar
              </Link>
            )}
          </>
        ) : (
          <span className="meta">Toca una hora libre. Para jugar más tiempo, toca también las horas siguientes.</span>
        )}
      </div>

    </section>
  );
}
