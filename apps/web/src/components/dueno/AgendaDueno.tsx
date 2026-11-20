"use client";

// Agenda del dueño: un día, una cancha a la vez. Cada hora libre se puede
// reservar (anotar a quien llamó) o bloquear; cada reserva muestra quién es y
// se puede cobrar, marcar Jugó / No vino o cancelar con motivo.
// Todo lo valida la base de datos; aquí solo se arma la pantalla.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore, type FormEvent } from "react";
import {
  ACCION_TEXTO,
  accionesPosibles,
  enlaceWhatsApp,
  filasDeCancha,
  ORIGEN_TEXTO,
  precioDeTurnos,
  resumenDelDia,
  saldo,
  turnosSeguidosLibres,
  type AccionReserva,
  type AgendaDia,
  type Bloqueo,
  type ReservaAgenda,
  type TurnoAgenda,
} from "@/modules/agenda/dominio/agenda";
import type { LocalDelDueno } from "@/modules/agenda/dominio/agenda.repositorio";
import { ESTADO_TEXTO } from "@/modules/reservas/dominio/reserva";
import { fechaLarga, horaLima, minutosTexto, soles, sumarDias } from "@/modules/reservas/dominio/tiempo";

type Props = { agenda: AgendaDia; locales: LocalDelDueno[]; hoy: string; canchaInicial?: string };

type Abierto =
  | { tipo: "reservar" | "bloquear"; inicio: string }
  | { tipo: "cobrar" | "cancelar"; reservaId: string }
  | null;

type Aviso = { error: boolean; texto: string } | null;

// Reloj por minuto (sin Date.now() en el render). En el servidor se usa la hora de la base.
const suscribir = (aviso: () => void) => {
  const t = setInterval(aviso, 30_000);
  return () => clearInterval(t);
};
const minutoActual = () => Math.floor(Date.now() / 60_000) * 60_000;

const MOTIVOS_BLOQUEO = ["Mantenimiento", "Torneo", "Evento privado"];
const MOTIVOS_CANCELAR = ["Lluvia", "Mantenimiento", "El jugador avisó que no viene"];

async function llamar(url: string, metodo: string, cuerpo?: unknown): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(url, {
    method: metodo,
    headers: cuerpo === undefined ? undefined : { "Content-Type": "application/json" },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  }).catch(() => null);
  const json = await res?.json().catch(() => null);
  if (res?.ok && json?.ok) return { ok: true };
  return { ok: false, error: json?.error ?? "Sin conexión con el servidor. Inténtalo otra vez." };
}

export default function AgendaDueno({ agenda, locales, hoy, canchaInicial }: Props) {
  const router = useRouter();
  const ahoraServidor = new Date(agenda.ahora).getTime();
  const ahora = useSyncExternalStore(suscribir, minutoActual, () => ahoraServidor);

  const [canchaId, setCanchaId] = useState(
    agenda.canchas.find((c) => c.id === canchaInicial)?.id ?? agenda.canchas[0]?.id ?? "",
  );
  const [abierto, setAbierto] = useState<Abierto>(null);
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState<Aviso>(null);

  const cancha = agenda.canchas.find((c) => c.id === canchaId);
  const filas = cancha ? filasDeCancha(agenda, cancha.id, ahora) : [];
  const resumen = resumenDelDia(agenda);

  const ir = (cambios: { local?: string; fecha?: string; cancha?: string }) => {
    const q = new URLSearchParams({
      local: cambios.local ?? agenda.local.id,
      fecha: cambios.fecha ?? agenda.fecha,
    });
    const c = cambios.cancha ?? (cambios.local ? undefined : canchaId);
    if (c) q.set("cancha", c);
    router.push(`/dueno/agenda?${q}`);
  };

  async function hacer(accion: () => Promise<{ ok: boolean; error?: string }>, exito: string) {
    setEnviando(true);
    setAviso(null);
    const r = await accion();
    setEnviando(false);
    if (!r.ok) {
      setAviso({ error: true, texto: r.error ?? "No se pudo guardar." });
      return;
    }
    setAbierto(null);
    setAviso({ error: false, texto: exito });
    router.refresh();
  }

  const accionRapida = (r: ReservaAgenda, accion: AccionReserva) =>
    hacer(
      () => llamar(`/api/dueno/reservas/${r.id}`, "PATCH", { accion }),
      accion === "jugo" ? `${r.codigo}: marcada como jugada.` : `${r.codigo}: marcada como "No vino".`,
    );

  return (
    <div className="agenda">
      <div className="agenda-barra">
        {locales.length <= 1 && <p className="agenda-local-nombre">{agenda.local.nombre}</p>}
        {locales.length > 1 && (
          <label className="agenda-local">
            Local
            <select className="campo" value={agenda.local.id} onChange={(e) => ir({ local: e.target.value })}>
              {locales.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.nombre}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="agenda-dias" role="group" aria-label="Cambiar de día">
          <button type="button" className="boton boton--claro" onClick={() => ir({ fecha: sumarDias(agenda.fecha, -1) })}>
            ← Anterior
          </button>
          <button
            type="button"
            className="boton boton--claro"
            aria-pressed={agenda.fecha === hoy}
            onClick={() => ir({ fecha: hoy })}
          >
            Hoy
          </button>
          <button type="button" className="boton boton--claro" onClick={() => ir({ fecha: sumarDias(agenda.fecha, 1) })}>
            Siguiente →
          </button>
          <input
            type="date"
            className="campo"
            aria-label="Elegir fecha"
            value={agenda.fecha}
            onChange={(e) => e.target.value && ir({ fecha: e.target.value })}
          />
        </div>
      </div>

      <h2 className="agenda-fecha">
        {fechaLarga(`${agenda.fecha}T12:00:00-05:00`)}
        {agenda.fecha === hoy ? " · Hoy" : ""}
      </h2>

      <div className="agenda-resumen" aria-label="Resumen del día">
        <div>
          <span>Reservas</span>
          <strong>{resumen.reservas}</strong>
        </div>
        <div>
          <span>Total del día</span>
          <strong>{soles(resumen.total)}</strong>
        </div>
        <div>
          <span>Cobrado</span>
          <strong>{soles(resumen.cobrado)}</strong>
        </div>
        <div>
          <span>Por cobrar</span>
          <strong>{soles(resumen.porCobrar)}</strong>
        </div>
      </div>
      {resumen.porConfirmar > 0 && (
        <p className="aviso">
          {resumen.porConfirmar === 1 ? "1 reserva espera" : `${resumen.porConfirmar} reservas esperan`} el pago o tu
          confirmación. <Link href="/dueno#pagos">Ver pagos por revisar</Link>
        </p>
      )}

      {agenda.canchas.length > 1 && (
        <div className="chips" role="group" aria-label="Cancha">
          {agenda.canchas.map((c) => (
            <button
              key={c.id}
              type="button"
              className="chip"
              aria-pressed={c.id === canchaId}
              onClick={() => {
                setCanchaId(c.id);
                setAbierto(null);
              }}
            >
              {c.nombre} · {c.deporte}
            </button>
          ))}
        </div>
      )}

      {aviso && (
        <p className={`aviso${aviso.error ? " aviso--error" : " aviso--ok"}`} role={aviso.error ? "alert" : "status"}>
          {aviso.texto}
        </p>
      )}

      {!cancha ? (
        <p className="meta">Este local todavía no tiene canchas activas.</p>
      ) : filas.length === 0 ? (
        <p className="vacio">Este día la cancha no atiende.</p>
      ) : (
        <ol className="agenda-filas">
          {filas.map((f) =>
            f.tipo === "libre" ? (
              <FilaLibre
                key={f.turno.inicio}
                turno={f.turno}
                pasado={f.pasado}
                abierto={abierto}
                setAbierto={setAbierto}
                enviando={enviando}
                agenda={agenda}
                canchaId={cancha.id}
                minutosTurno={cancha.minutosTurno}
                ahora={ahora}
                hacer={hacer}
              />
            ) : f.tipo === "bloqueo" ? (
              <FilaBloqueo key={`b${f.bloqueo.id}`} bloqueo={f.bloqueo} enviando={enviando} hacer={hacer} />
            ) : (
              <FilaReserva
                key={f.reserva.id}
                r={f.reserva}
                local={agenda.local.nombre}
                ahora={ahora}
                abierto={abierto}
                setAbierto={setAbierto}
                enviando={enviando}
                hacer={hacer}
                accionRapida={accionRapida}
              />
            ),
          )}
        </ol>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------
// Hora libre: Reservar (anotar) o Bloquear
// ---------------------------------------------------------------------
type FilaLibreProps = {
  turno: TurnoAgenda;
  pasado: boolean;
  abierto: Abierto;
  setAbierto: (a: Abierto) => void;
  enviando: boolean;
  agenda: AgendaDia;
  canchaId: string;
  minutosTurno: number;
  ahora: number;
  hacer: (a: () => Promise<{ ok: boolean; error?: string }>, exito: string) => Promise<void>;
};

function FilaLibre(p: FilaLibreProps) {
  const { turno, pasado, abierto } = p;
  const abiertoAqui = abierto && "inicio" in abierto && abierto.inicio === turno.inicio ? abierto.tipo : null;
  const yaTermino = new Date(turno.fin).getTime() <= p.ahora;

  return (
    <li className={`fila-agenda fila-agenda--libre${pasado ? " fila-agenda--pasado" : ""}`}>
      <div className="fila-agenda-cabeza">
        <span className="fila-hora">
          {horaLima(turno.inicio)} – {horaLima(turno.fin)}
        </span>
        <span className="meta">{pasado ? "Sin reserva" : `Libre · ${turno.precio != null ? soles(turno.precio) : "sin precio"}`}</span>
        {!abiertoAqui && (
          <span className="fila-acciones">
            <button
              type="button"
              className="boton boton--claro boton--chico"
              onClick={() => p.setAbierto({ tipo: "reservar", inicio: turno.inicio })}
            >
              {pasado ? "Anotar" : "+ Reservar"}
            </button>
            {!yaTermino && (
              <button
                type="button"
                className="boton boton--claro boton--chico"
                onClick={() => p.setAbierto({ tipo: "bloquear", inicio: turno.inicio })}
              >
                Bloquear
              </button>
            )}
          </span>
        )}
      </div>
      {abiertoAqui === "reservar" && <FormReservar {...p} />}
      {abiertoAqui === "bloquear" && <FormBloquear {...p} />}
    </li>
  );
}

function FormReservar(p: FilaLibreProps) {
  const opciones = turnosSeguidosLibres(p.agenda, p.canchaId, p.turno.inicio);
  const [hasta, setHasta] = useState(opciones[0]?.fin ?? p.turno.fin);
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [pagado, setPagado] = useState("");
  const [nota, setNota] = useState("");
  const elegidos = opciones.filter((t) => new Date(t.fin).getTime() <= new Date(hasta).getTime());
  const total = precioDeTurnos(elegidos, p.minutosTurno);

  function enviar(e: FormEvent) {
    e.preventDefault();
    void p.hacer(
      () =>
        llamar("/api/dueno/reservas", "POST", {
          canchaId: p.canchaId,
          inicio: p.turno.inicio,
          fin: hasta,
          nombre,
          telefono,
          pagado: pagado || 0,
          nota,
        }),
      `Reserva de ${nombre.trim()} guardada (${horaLima(p.turno.inicio)} – ${horaLima(hasta)}).`,
    );
  }

  return (
    <form className="form-agenda" onSubmit={enviar}>
      <label>
        Nombre de quien reserva
        <input className="campo" value={nombre} onChange={(e) => setNombre(e.target.value)} required minLength={2} maxLength={120} autoFocus />
      </label>
      <label>
        Celular (opcional)
        <input className="campo" inputMode="tel" placeholder="9XX XXX XXX" value={telefono} onChange={(e) => setTelefono(e.target.value)} />
      </label>
      <label>
        Hasta
        <select className="campo" value={hasta} onChange={(e) => setHasta(e.target.value)}>
          {opciones.map((t, i) => (
            <option key={t.fin} value={t.fin}>
              {horaLima(t.fin)} ({minutosTexto((i + 1) * p.minutosTurno)} · {soles(precioDeTurnos(opciones.slice(0, i + 1), p.minutosTurno))})
            </option>
          ))}
        </select>
      </label>
      <label>
        Ya pagó en efectivo (S/)
        <input
          className="campo"
          inputMode="decimal"
          placeholder="0"
          value={pagado}
          onChange={(e) => setPagado(e.target.value)}
        />
      </label>
      <label className="form-agenda-ancho">
        Nota (opcional)
        <input className="campo" placeholder="Ej.: Equipo de la universidad, trae su pelota" value={nota} maxLength={300} onChange={(e) => setNota(e.target.value)} />
      </label>
      <p className="meta form-agenda-ancho">Total: {soles(total)}. Queda confirmada al guardar.</p>
      <div className="revision-botones form-agenda-ancho">
        <button type="submit" className="boton boton--naranja" disabled={p.enviando}>
          {p.enviando ? "Guardando…" : "Guardar reserva"}
        </button>
        <button type="button" className="boton boton--claro" onClick={() => p.setAbierto(null)}>
          Cerrar
        </button>
      </div>
    </form>
  );
}

function FormBloquear(p: FilaLibreProps) {
  const opciones = turnosSeguidosLibres(p.agenda, p.canchaId, p.turno.inicio, 24 * 60);
  const [hasta, setHasta] = useState(opciones[0]?.fin ?? p.turno.fin);
  const [motivo, setMotivo] = useState("Mantenimiento");

  function enviar(e: FormEvent) {
    e.preventDefault();
    void p.hacer(
      () => llamar("/api/dueno/bloqueos", "POST", { canchaId: p.canchaId, inicio: p.turno.inicio, fin: hasta, motivo }),
      `Cancha cerrada de ${horaLima(p.turno.inicio)} a ${horaLima(hasta)}. Los jugadores la ven como "Cerrada".`,
    );
  }

  return (
    <form className="form-agenda" onSubmit={enviar}>
      <label>
        Cerrar hasta
        <select className="campo" value={hasta} onChange={(e) => setHasta(e.target.value)}>
          {opciones.map((t) => (
            <option key={t.fin} value={t.fin}>
              {horaLima(t.fin)}
            </option>
          ))}
        </select>
      </label>
      <label>
        Motivo
        <input className="campo" value={motivo} maxLength={120} onChange={(e) => setMotivo(e.target.value)} />
      </label>
      <div className="chips form-agenda-ancho">
        {MOTIVOS_BLOQUEO.map((m) => (
          <button key={m} type="button" className="chip" aria-pressed={motivo === m} onClick={() => setMotivo(m)}>
            {m}
          </button>
        ))}
      </div>
      <div className="revision-botones form-agenda-ancho">
        <button type="submit" className="boton boton--peligro" disabled={p.enviando}>
          {p.enviando ? "Guardando…" : "Bloquear"}
        </button>
        <button type="button" className="boton boton--claro" onClick={() => p.setAbierto(null)}>
          Cerrar
        </button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------
// Bloqueo
// ---------------------------------------------------------------------
function FilaBloqueo({
  bloqueo,
  enviando,
  hacer,
}: {
  bloqueo: Bloqueo;
  enviando: boolean;
  hacer: FilaLibreProps["hacer"];
}) {
  return (
    <li className="fila-agenda fila-agenda--bloqueo">
      <div className="fila-agenda-cabeza">
        <span className="fila-hora">
          {horaLima(bloqueo.inicio)} – {horaLima(bloqueo.fin)}
        </span>
        <span>
          <strong>Cerrada</strong>
          {bloqueo.motivo ? ` · ${bloqueo.motivo}` : ""}
        </span>
        <span className="fila-acciones">
          <button
            type="button"
            className="boton boton--claro boton--chico"
            disabled={enviando}
            onClick={() => hacer(() => llamar(`/api/dueno/bloqueos/${bloqueo.id}`, "DELETE"), "Horas abiertas otra vez.")}
          >
            Abrir de nuevo
          </button>
        </span>
      </div>
    </li>
  );
}

// ---------------------------------------------------------------------
// Reserva
// ---------------------------------------------------------------------
type FilaReservaProps = {
  r: ReservaAgenda;
  local: string;
  ahora: number;
  abierto: Abierto;
  setAbierto: (a: Abierto) => void;
  enviando: boolean;
  hacer: FilaLibreProps["hacer"];
  accionRapida: (r: ReservaAgenda, a: AccionReserva) => Promise<void>;
};

function FilaReserva({ r, local, ahora, abierto, setAbierto, enviando, hacer, accionRapida }: FilaReservaProps) {
  const acciones = accionesPosibles(r, ahora);
  const abiertoAqui = abierto && "reservaId" in abierto && abierto.reservaId === r.id ? abierto.tipo : null;
  const falta = saldo(r);
  const wa = enlaceWhatsApp(r.telefono, `Hola ${r.jugador ?? ""}, te escribimos de ${local} por tu reserva ${r.codigo}.`);

  return (
    <li className={`fila-agenda fila-agenda--reserva fila-agenda--${r.estado}`}>
      <div className="fila-agenda-cabeza">
        <span className="fila-hora">
          {horaLima(r.inicio)} – {horaLima(r.fin)}
        </span>
        <span className={`estado estado--${r.estado}`}>{ESTADO_TEXTO[r.estado]}</span>
      </div>
      <div className="fila-reserva-datos">
        <strong>{r.jugador ?? "Sin nombre"}</strong>
        {r.telefono && (
          <span>
            <a href={`tel:${r.telefono.replace(/[^\d+]/g, "")}`}>{r.telefono}</a>
            {wa && (
              <>
                {" · "}
                <a href={wa} target="_blank" rel="noopener noreferrer">
                  WhatsApp
                </a>
              </>
            )}
          </span>
        )}
        <span className="meta">
          <span className="codigo">{r.codigo}</span> · {ORIGEN_TEXTO[r.origen] ?? r.origen}
        </span>
        <span>
          Total {soles(r.total)} · Pagado {soles(r.pagado)}
          {falta > 0 ? (
            <>
              {" · "}
              <strong>Falta {soles(falta)}</strong>
            </>
          ) : null}
        </span>
        {r.nota && <span className="meta">Nota: {r.nota}</span>}
        {r.estado === "payment_review" && (
          <span>
            <Link href="/dueno#pagos">Revisar el comprobante que envió →</Link>
          </span>
        )}
      </div>

      {!abiertoAqui && acciones.length > 0 && (
        <div className="revision-botones">
          {acciones.map((a) =>
            a === "jugo" || a === "no_vino" ? (
              <button
                key={a}
                type="button"
                className="boton boton--claro boton--chico"
                disabled={enviando}
                onClick={() => accionRapida(r, a)}
              >
                {ACCION_TEXTO[a]}
              </button>
            ) : (
              <button
                key={a}
                type="button"
                className={`boton boton--chico ${a === "cobrar" ? "boton--naranja" : "boton--claro"}`}
                disabled={enviando}
                onClick={() => setAbierto({ tipo: a, reservaId: r.id })}
              >
                {ACCION_TEXTO[a]}
              </button>
            ),
          )}
        </div>
      )}
      {abiertoAqui === "cobrar" && (
        <FormCobrar r={r} falta={falta} enviando={enviando} hacer={hacer} cerrar={() => setAbierto(null)} />
      )}
      {abiertoAqui === "cancelar" && (
        <FormCancelar r={r} enviando={enviando} hacer={hacer} cerrar={() => setAbierto(null)} />
      )}
    </li>
  );
}

type FormAccionProps = { r: ReservaAgenda; enviando: boolean; hacer: FilaLibreProps["hacer"]; cerrar: () => void };

function FormCobrar({ r, falta, enviando, hacer, cerrar }: FormAccionProps & { falta: number }) {
  const [monto, setMonto] = useState(String(falta));
  function enviar(e: FormEvent) {
    e.preventDefault();
    void hacer(
      () => llamar(`/api/dueno/reservas/${r.id}`, "PATCH", { accion: "cobrar", monto }),
      `${r.codigo}: cobro de S/ ${monto} registrado.`,
    );
  }
  return (
    <form className="form-agenda" onSubmit={enviar}>
      <label>
        Monto cobrado en efectivo (S/)
        <input className="campo" inputMode="decimal" value={monto} onChange={(e) => setMonto(e.target.value)} required autoFocus />
      </label>
      <div className="revision-botones form-agenda-ancho">
        <button type="submit" className="boton boton--naranja" disabled={enviando}>
          {enviando ? "Guardando…" : "Registrar cobro"}
        </button>
        <button type="button" className="boton boton--claro" onClick={cerrar}>
          Cerrar
        </button>
      </div>
    </form>
  );
}

function FormCancelar({ r, enviando, hacer, cerrar }: FormAccionProps) {
  const [motivo, setMotivo] = useState("");
  function enviar(e: FormEvent) {
    e.preventDefault();
    void hacer(
      () => llamar(`/api/dueno/reservas/${r.id}`, "PATCH", { accion: "cancelar", motivo }),
      `${r.codigo}: reserva cancelada. ${r.origen === "owner_manual" ? "" : "El jugador verá el motivo en su reserva."}`,
    );
  }
  return (
    <form className="form-agenda" onSubmit={enviar}>
      <div className="chips form-agenda-ancho">
        {MOTIVOS_CANCELAR.map((m) => (
          <button key={m} type="button" className="chip" aria-pressed={motivo === m} onClick={() => setMotivo(m)}>
            {m}
          </button>
        ))}
      </div>
      <label className="form-agenda-ancho">
        Motivo (lo verá el jugador)
        <input className="campo" value={motivo} maxLength={200} minLength={3} required onChange={(e) => setMotivo(e.target.value)} />
      </label>
      {r.pagado > 0 && (
        <p className="aviso form-agenda-ancho">Ya pagó {soles(r.pagado)}: acuerda con el jugador la devolución.</p>
      )}
      <div className="revision-botones form-agenda-ancho">
        <button type="submit" className="boton boton--peligro" disabled={enviando || motivo.trim().length < 3}>
          {enviando ? "Cancelando…" : "Cancelar reserva"}
        </button>
        <button type="button" className="boton boton--claro" onClick={cerrar}>
          Volver
        </button>
      </div>
    </form>
  );
}
