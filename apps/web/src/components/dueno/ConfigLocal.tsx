"use client";

// Configuración del local: reglas de reserva (adelanto, apartado, cancelación),
// contacto, servicios (vestuarios, duchas...) y, por cada cancha, nombre,
// deporte, horario por día y precios.
// Todo lo valida la base de datos; aquí solo se arma la pantalla.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import { SERVICIOS } from "@/modules/catalogo/dominio/servicios";
import { enlaceWhatsApp, MENSAJES_WHATSAPP } from "@/modules/compartido/dominio/whatsapp";
import { llamarApi, type RespuestaApi } from "@/modules/compartido/presentacion/llamar-api";
import {
  DEPORTES,
  DIAS,
  diaValido,
  ESTADO_LOCAL_TEXTO,
  horasEntre,
  nombreDeporte,
  OPCIONES_ADELANTO,
  OPCIONES_APARTADO,
  OPCIONES_CANCELACION,
  opcionesDuracion,
  resumenHorario,
  type CanchaConfig,
  type ConfigLocal as Config,
  type DiaHorario,
} from "@/modules/locales/dominio/configuracion";
import type { LocalPropio } from "@/modules/locales/dominio/locales.repositorio";
import { minutosTexto, soles } from "@/modules/reservas/dominio/tiempo";

type Aviso = { tipo: "ok" | "error" | "ojo"; texto: string } | null;

const conActual = (opciones: number[], actual: number) => [...new Set([...opciones, actual])].sort((a, b) => a - b);
const HORAS_ABRE = horasEntre("00:00", "23:30");
const HORAS_CIERRA = horasEntre("00:30", "24:00");
const HORAS_PUNTA = horasEntre("00:30", "23:30");

function AvisoTexto({ aviso }: { aviso: Aviso }) {
  if (!aviso) return null;
  const clase = aviso.tipo === "ok" ? "aviso aviso--ok" : aviso.tipo === "error" ? "aviso aviso--error" : "aviso";
  return (
    <p className={clase} role={aviso.tipo === "error" ? "alert" : "status"}>
      {aviso.texto}
    </p>
  );
}

/** Envía, muestra el resultado y recarga los datos del servidor */
function useEnvio() {
  const router = useRouter();
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState<Aviso>(null);
  async function enviar<T>(llamada: () => Promise<RespuestaApi<T>>, exito: (datos: T) => Aviso) {
    setEnviando(true);
    setAviso(null);
    const r = await llamada();
    setEnviando(false);
    if (!r.ok) {
      setAviso({ tipo: "error", texto: r.error });
      return false;
    }
    setAviso(exito(r.datos));
    router.refresh();
    return true;
  }
  return { enviando, aviso, setAviso, enviar };
}

type Props = { config: Config; locales: LocalPropio[]; whatsappSoporte?: string | null };

export default function ConfigLocal({ config, locales, whatsappSoporte = null }: Props) {
  const router = useRouter();
  const { local, canchas } = config;
  const ayuda = enlaceWhatsApp(whatsappSoporte, MENSAJES_WHATSAPP.localSuspendido(local.nombre));
  return (
    <div className="config">
      <div className="agenda-barra">
        {locales.length > 1 ? (
          <label className="agenda-local">
            Local
            <select
              className="campo"
              value={local.id}
              onChange={(e) => router.push(`/dueno/configuracion?local=${e.target.value}`)}
            >
              {locales.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.nombre} ({ESTADO_LOCAL_TEXTO[l.estado] ?? l.estado})
                </option>
              ))}
            </select>
          </label>
        ) : (
          <p className="agenda-local-nombre">{local.nombre}</p>
        )}
        <span className={`estado estado--local-${local.estado}`}>{ESTADO_LOCAL_TEXTO[local.estado] ?? local.estado}</span>
        <span className="config-enlaces">
          {local.estado !== "pending_review" && <Link href={`/dueno/agenda?local=${local.id}`}>Agenda</Link>}
          {local.estado === "approved" && <Link href={`/cancha/${local.slug}`}>Ver como jugador</Link>}
        </span>
      </div>

      {local.estado === "suspended" && (
        <p className="aviso aviso--error">
          El administrador suspendió este local{local.motivoEstado ? `: “${local.motivoEstado}”` : ""}. No aparece en el
          mapa ni recibe reservas nuevas. Si crees que es un error,{" "}
          {ayuda ? (
            <a className="enlace-wsp" href={ayuda} target="_blank" rel="noopener noreferrer">
              escribe al administrador por WhatsApp
            </a>
          ) : (
            "escribe al administrador"
          )}
          .
        </p>
      )}
      {local.estado === "pending_review" && (
        <p className="aviso">Tu local está en revisión. Puedes dejar listos los precios y horarios antes de que se publique.</p>
      )}

      <FormReglas key={local.id} config={config} />

      <FormServicios key={`servicios-${local.id}`} localId={local.id} actuales={local.servicios} />

      {canchas.map((c, i) => (
        <FormCancha key={c.id} cancha={c} abierta={i === 0} unica={canchas.length === 1} />
      ))}

      <FormAgregar localId={local.id} />
    </div>
  );
}

function Campo({ etiqueta, ayuda, children, ancho }: { etiqueta: string; ayuda?: string; children: ReactNode; ancho?: boolean }) {
  return (
    <label className={ancho ? "config-campo config-ancho" : "config-campo"}>
      {etiqueta}
      {children}
      {ayuda && <span className="meta">{ayuda}</span>}
    </label>
  );
}

function FormReglas({ config }: { config: Config }) {
  const l = config.local;
  const [adelanto, setAdelanto] = useState(l.adelantoPct);
  const [apartado, setApartado] = useState(l.minutosApartado);
  const [cancelacion, setCancelacion] = useState(l.horasCancelacion);
  const [whatsapp, setWhatsapp] = useState(l.whatsapp ?? "");
  const [direccion, setDireccion] = useState(l.direccion);
  const [referencia, setReferencia] = useState(l.referencia ?? "");
  const { enviando, aviso, enviar } = useEnvio();

  function guardar(e: FormEvent) {
    e.preventDefault();
    void enviar(
      () =>
        llamarApi(`/api/dueno/locales/${l.id}`, "PUT", {
          adelantoPct: adelanto,
          minutosApartado: apartado,
          horasCancelacion: cancelacion,
          whatsapp,
          direccion,
          referencia,
        }),
      () => ({ tipo: "ok", texto: "Reglas guardadas. Las reservas nuevas ya usan estos valores." }),
    );
  }

  return (
    <section className="panel" aria-labelledby="t-reglas">
      <h2 id="t-reglas">Reglas de reserva</h2>
      <form className="config-form" onSubmit={guardar}>
        <Campo etiqueta="Adelanto para reservar por la web" ayuda="El resto lo cobras en el local.">
          <select className="campo" value={adelanto} onChange={(e) => setAdelanto(Number(e.target.value))}>
            {conActual(OPCIONES_ADELANTO, l.adelantoPct).map((p) => (
              <option key={p} value={p}>
                {p === 0 ? "Sin adelanto" : `${p} %`}
              </option>
            ))}
          </select>
        </Campo>
        <Campo etiqueta="Tiempo para pagar el adelanto" ayuda="Si no paga en ese tiempo, la hora se libera sola.">
          <select className="campo" value={apartado} onChange={(e) => setApartado(Number(e.target.value))}>
            {conActual(OPCIONES_APARTADO, l.minutosApartado).map((m) => (
              <option key={m} value={m}>
                {m} minutos
              </option>
            ))}
          </select>
        </Campo>
        <Campo etiqueta="El jugador puede cancelar hasta" ayuda="Después de ese plazo ya no puede cancelar desde la web.">
          <select className="campo" value={cancelacion} onChange={(e) => setCancelacion(Number(e.target.value))}>
            {conActual(OPCIONES_CANCELACION, l.horasCancelacion).map((h) => (
              <option key={h} value={h}>
                {h === 0 ? "La hora del partido" : `${h} ${h === 1 ? "hora" : "horas"} antes`}
              </option>
            ))}
          </select>
        </Campo>
        <Campo etiqueta="WhatsApp del local (opcional)" ayuda="Aparece en la ficha para que los jugadores te escriban.">
          <input className="campo" inputMode="tel" placeholder="9XX XXX XXX" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} />
        </Campo>
        <Campo etiqueta="Dirección" ancho>
          <input className="campo" value={direccion} maxLength={200} required minLength={5} onChange={(e) => setDireccion(e.target.value)} />
        </Campo>
        <Campo etiqueta="Referencia (opcional)" ancho>
          <input
            className="campo"
            placeholder="Ej.: Frente al colegio, puerta verde"
            value={referencia}
            maxLength={200}
            onChange={(e) => setReferencia(e.target.value)}
          />
        </Campo>
        <div className="config-ancho config-pie">
          <button type="submit" className="boton boton--naranja" disabled={enviando}>
            {enviando ? "Guardando…" : "Guardar reglas"}
          </button>
          <AvisoTexto aviso={aviso} />
        </div>
      </form>
    </section>
  );
}

function FormServicios({ localId, actuales }: { localId: string; actuales: string[] }) {
  const [marcados, setMarcados] = useState<string[]>(actuales);
  const { enviando, aviso, enviar } = useEnvio();
  const alternar = (codigo: string, si: boolean) =>
    setMarcados((m) => (si ? [...m.filter((x) => x !== codigo), codigo] : m.filter((x) => x !== codigo)));

  function guardar(e: FormEvent) {
    e.preventDefault();
    void enviar(
      () => llamarApi<{ local: { servicios: string[] } }>(`/api/dueno/locales/${localId}/servicios`, "PUT", { servicios: marcados }),
      (d) => ({
        tipo: "ok",
        texto: d.local.servicios.length
          ? "Servicios guardados. Ya salen en tu ficha y en los filtros del mapa."
          : "Guardado: tu local no muestra servicios.",
      }),
    );
  }

  return (
    <section className="panel" aria-labelledby="t-servicios">
      <h2 id="t-servicios">Servicios del local</h2>
      <p className="meta">Marca lo que ofreces. Los jugadores lo ven en tu ficha y pueden filtrar el mapa por estos servicios.</p>
      <form className="config-form" onSubmit={guardar}>
        <fieldset className="servicios-form config-ancho">
          <legend className="sr-only">Servicios</legend>
          {SERVICIOS.map((s) => (
            <label key={s.codigo} className="config-check">
              <input
                type="checkbox"
                name="servicio"
                value={s.codigo}
                checked={marcados.includes(s.codigo)}
                onChange={(e) => alternar(s.codigo, e.target.checked)}
              />
              {s.nombre}
            </label>
          ))}
        </fieldset>
        <div className="config-ancho config-pie">
          <button type="submit" className="boton boton--naranja" disabled={enviando}>
            {enviando ? "Guardando…" : "Guardar servicios"}
          </button>
          <AvisoTexto aviso={aviso} />
        </div>
      </form>
    </section>
  );
}

function FormCancha({ cancha, abierta, unica }: { cancha: CanchaConfig; abierta: boolean; unica: boolean }) {
  const [nombre, setNombre] = useState(cancha.nombre);
  const [deporte, setDeporte] = useState(cancha.deporte);
  const [techada, setTechada] = useState(cancha.techada);
  const [maxMinutos, setMaxMinutos] = useState(cancha.maxMinutos);
  const [precio, setPrecio] = useState(cancha.precio != null ? String(cancha.precio) : "");
  const [conPunta, setConPunta] = useState(cancha.precioPunta != null);
  const [precioPunta, setPrecioPunta] = useState(cancha.precioPunta != null ? String(cancha.precioPunta) : "");
  const [puntaDesde, setPuntaDesde] = useState(cancha.puntaDesde ?? "18:00");
  const [horario, setHorario] = useState<DiaHorario[]>(cancha.horario);
  const [quitando, setQuitando] = useState(false);
  const { enviando, aviso, setAviso, enviar } = useEnvio();

  const del = (dia: number) => horario.find((h) => h.dia === dia);
  const cambiarDia = (dia: number, cambio: Partial<DiaHorario> | null) =>
    setHorario((actual) => {
      const sin = actual.filter((h) => h.dia !== dia);
      if (cambio === null) return sin;
      const previo = actual.find((h) => h.dia === dia) ?? { dia, abre: "08:00", cierra: "23:00" };
      return [...sin, { ...previo, ...cambio }].sort((a, b) => a.dia - b.dia);
    });
  const copiarLunes = () => {
    const lunes = del(1);
    setHorario(lunes ? DIAS.map(({ dia }) => ({ dia, abre: lunes.abre, cierra: lunes.cierra })) : []);
  };
  const malos = horario.filter((h) => !diaValido(h, cancha.minutosTurno));

  function guardar(e: FormEvent) {
    e.preventDefault();
    if (malos.length) {
      setAviso({ tipo: "error", texto: "Revisa el horario: en cada día abierto la apertura va antes del cierre." });
      return;
    }
    void enviar<{ cancha: { fueraDeHorario: number } }>(
      () =>
        llamarApi(`/api/dueno/canchas/${cancha.id}`, "PUT", {
          nombre,
          deporte,
          techada,
          maxMinutos,
          horario,
          precio,
          precioPunta: conPunta ? precioPunta : null,
          puntaDesde: conPunta ? puntaDesde : null,
        }),
      ({ cancha: r }) =>
        r.fueraDeHorario > 0
          ? {
              tipo: "ojo",
              texto: `Guardado. Ojo: ${r.fueraDeHorario} ${r.fueraDeHorario === 1 ? "reserva quedó" : "reservas quedaron"} fuera del nuevo horario. Siguen en pie: revísalas en la agenda.`,
            }
          : { tipo: "ok", texto: "Cancha guardada. Los jugadores ya ven el horario y los precios nuevos." },
    );
  }

  function quitar() {
    void enviar(() => llamarApi(`/api/dueno/canchas/${cancha.id}`, "DELETE"), () => ({ tipo: "ok", texto: "Cancha quitada." }));
  }

  const precioTexto = cancha.precio != null ? `${soles(cancha.precio)} la hora` : "sin precio";
  return (
    <details className="panel config-cancha" open={abierta}>
      <summary>
        <span className="config-cancha-nombre">
          {cancha.nombre} · {nombreDeporte(cancha.deporte)}
        </span>
        <span className="meta">
          {precioTexto}
          {cancha.precioPunta != null && ` · hora punta ${soles(cancha.precioPunta)} desde ${cancha.puntaDesde}`}
          {" · "}
          {resumenHorario(cancha.horario)}
        </span>
      </summary>

      <form className="config-form" onSubmit={guardar}>
        <Campo etiqueta="Nombre">
          <input className="campo" value={nombre} maxLength={60} required minLength={2} onChange={(e) => setNombre(e.target.value)} />
        </Campo>
        <Campo etiqueta="Deporte">
          <select className="campo" value={deporte} onChange={(e) => setDeporte(e.target.value)}>
            {DEPORTES.map((d) => (
              <option key={d.codigo} value={d.codigo}>
                {d.nombre}
              </option>
            ))}
          </select>
        </Campo>
        <Campo etiqueta="Máximo por reserva">
          <select className="campo" value={maxMinutos} onChange={(e) => setMaxMinutos(Number(e.target.value))}>
            {opcionesDuracion(cancha.minutosTurno).map((m) => (
              <option key={m} value={m}>
                {minutosTexto(m)}
              </option>
            ))}
          </select>
        </Campo>
        <label className="config-check">
          <input type="checkbox" checked={techada} onChange={(e) => setTechada(e.target.checked)} /> Cancha techada
        </label>

        <Campo etiqueta="Precio por hora (S/)">
          <input className="campo" inputMode="decimal" value={precio} required onChange={(e) => setPrecio(e.target.value)} />
        </Campo>
        <label className="config-check">
          <input type="checkbox" checked={conPunta} onChange={(e) => setConPunta(e.target.checked)} /> Cobrar otro precio en
          hora punta
        </label>
        {conPunta && (
          <>
            <Campo etiqueta="Precio en hora punta (S/)">
              <input className="campo" inputMode="decimal" value={precioPunta} required onChange={(e) => setPrecioPunta(e.target.value)} />
            </Campo>
            <Campo etiqueta="Hora punta desde" ayuda="Rige hasta que cierra la cancha.">
              <select className="campo" value={puntaDesde} onChange={(e) => setPuntaDesde(e.target.value)}>
                {HORAS_PUNTA.map((h) => (
                  <option key={h}>{h}</option>
                ))}
              </select>
            </Campo>
          </>
        )}

        <fieldset className="config-ancho horario">
          <legend>Horario de atención</legend>
          {DIAS.map(({ dia, nombre: nombreDia }) => {
            const h = del(dia);
            const malo = h && !diaValido(h, cancha.minutosTurno);
            return (
              <div key={dia} className={`horario-dia${h ? "" : " horario-dia--cerrado"}${malo ? " horario-dia--malo" : ""}`}>
                <label className="config-check horario-nombre">
                  <input type="checkbox" checked={Boolean(h)} onChange={(e) => cambiarDia(dia, e.target.checked ? {} : null)} />
                  {nombreDia}
                </label>
                {h ? (
                  <span className="horario-horas">
                    <select className="campo" aria-label={`${nombreDia}: abre`} value={h.abre} onChange={(e) => cambiarDia(dia, { abre: e.target.value })}>
                      {HORAS_ABRE.map((x) => (
                        <option key={x}>{x}</option>
                      ))}
                    </select>
                    a
                    <select className="campo" aria-label={`${nombreDia}: cierra`} value={h.cierra} onChange={(e) => cambiarDia(dia, { cierra: e.target.value })}>
                      {HORAS_CIERRA.map((x) => (
                        <option key={x}>{x}</option>
                      ))}
                    </select>
                  </span>
                ) : (
                  <span className="meta">Cerrado</span>
                )}
              </div>
            );
          })}
          <button type="button" className="boton boton--claro boton--chico" onClick={copiarLunes} disabled={!del(1)}>
            Usar el horario del lunes en todos los días
          </button>
        </fieldset>

        <div className="config-ancho config-pie">
          <button type="submit" className="boton boton--naranja" disabled={enviando}>
            {enviando ? "Guardando…" : "Guardar cancha"}
          </button>
          {!unica && !quitando && (
            <button type="button" className="boton boton--claro" onClick={() => setQuitando(true)}>
              Quitar cancha
            </button>
          )}
          <AvisoTexto aviso={aviso} />
        </div>
        {quitando && (
          <div className="config-ancho form-agenda">
            {cancha.reservasFuturas > 0 ? (
              <p className="aviso form-agenda-ancho">
                Tiene {cancha.reservasFuturas} {cancha.reservasFuturas === 1 ? "reserva pendiente" : "reservas pendientes"}.
                Cancélalas en la agenda antes de quitarla.
              </p>
            ) : (
              <p className="meta form-agenda-ancho">
                Los jugadores ya no la verán. Las reservas pasadas quedan guardadas.
              </p>
            )}
            <div className="revision-botones form-agenda-ancho">
              <button type="button" className="boton boton--peligro" disabled={enviando || cancha.reservasFuturas > 0} onClick={quitar}>
                Sí, quitar {cancha.nombre}
              </button>
              <button type="button" className="boton boton--claro" onClick={() => setQuitando(false)}>
                Volver
              </button>
            </div>
          </div>
        )}
      </form>
    </details>
  );
}

function FormAgregar({ localId }: { localId: string }) {
  const [nombre, setNombre] = useState("");
  const [deporte, setDeporte] = useState<string>("futbol");
  const [precio, setPrecio] = useState("");
  const { enviando, aviso, enviar } = useEnvio();

  async function agregar(e: FormEvent) {
    e.preventDefault();
    const ok = await enviar(
      () => llamarApi(`/api/dueno/locales/${localId}/canchas`, "POST", { nombre, deporte, precio }),
      () => ({ tipo: "ok", texto: `${nombre} agregada con horario de 08:00 a 23:00. Ajústalo arriba si hace falta.` }),
    );
    if (ok) {
      setNombre("");
      setPrecio("");
    }
  }

  return (
    <section className="panel" aria-labelledby="t-agregar">
      <h2 id="t-agregar">Agregar una cancha</h2>
      <form className="config-form" onSubmit={agregar}>
        <Campo etiqueta="Nombre">
          <input className="campo" placeholder="Ej.: Cancha 2" value={nombre} maxLength={60} required minLength={2} onChange={(e) => setNombre(e.target.value)} />
        </Campo>
        <Campo etiqueta="Deporte">
          <select className="campo" value={deporte} onChange={(e) => setDeporte(e.target.value)}>
            {DEPORTES.map((d) => (
              <option key={d.codigo} value={d.codigo}>
                {d.nombre}
              </option>
            ))}
          </select>
        </Campo>
        <Campo etiqueta="Precio por hora (S/)">
          <input className="campo" inputMode="decimal" value={precio} required onChange={(e) => setPrecio(e.target.value)} />
        </Campo>
        <div className="config-ancho config-pie">
          <button type="submit" className="boton boton--claro" disabled={enviando}>
            {enviando ? "Agregando…" : "+ Agregar cancha"}
          </button>
          <AvisoTexto aviso={aviso} />
        </div>
      </form>
    </section>
  );
}
