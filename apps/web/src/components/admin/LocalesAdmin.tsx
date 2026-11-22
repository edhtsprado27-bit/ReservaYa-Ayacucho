"use client";

// Panel del administrador: locales publicados y suspendidos. Asignar el dueño
// real (por su correo), suspender con motivo o reactivar. Lo valida la base.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { enlaceWhatsApp, MENSAJES_WHATSAPP } from "@/modules/compartido/dominio/whatsapp";
import { llamarApi } from "@/modules/compartido/presentacion/llamar-api";
import { ESTADO_LOCAL_TEXTO, type LocalAdmin } from "@/modules/locales/dominio/configuracion";

type Abierto = { id: string; tipo: "dueno" | "suspender" } | null;
type Aviso = { id: string; error: boolean; texto: string } | null;

const MOTIVOS = ["Datos del local falsos", "Reclamos de jugadores", "Pedido del dueño"];

export default function LocalesAdmin({ locales }: { locales: LocalAdmin[] }) {
  const router = useRouter();
  const [abierto, setAbierto] = useState<Abierto>(null);
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState<Aviso>(null);
  const [correo, setCorreo] = useState("");
  const [motivo, setMotivo] = useState("");

  const abrir = (id: string, tipo: "dueno" | "suspender") => {
    setAbierto({ id, tipo });
    setCorreo("");
    setMotivo("");
    setAviso(null);
  };

  async function patch(l: LocalAdmin, cuerpo: Record<string, string>, exito: (d: Record<string, unknown>) => string) {
    setEnviando(true);
    setAviso(null);
    const r = await llamarApi<{ local: Record<string, unknown> }>(`/api/admin/locales/${l.id}`, "PATCH", cuerpo);
    setEnviando(false);
    if (!r.ok) {
      setAviso({ id: l.id, error: true, texto: r.error });
      return;
    }
    setAbierto(null);
    setAviso({ id: l.id, error: false, texto: exito(r.datos.local) });
    router.refresh();
  }

  if (locales.length === 0) return <p className="meta">Todavía no hay locales publicados.</p>;

  return (
    <ul className="lista-revision">
      {locales.map((l) => {
        const aqui = abierto?.id === l.id ? abierto.tipo : null;
        const futuras = l.reservasFuturas === 1 ? "1 reserva pendiente" : `${l.reservasFuturas} reservas pendientes`;
        // Al dueño: su celular de la cuenta; si no tiene, el WhatsApp del local
        const wsp = l.sinDueno ? null : enlaceWhatsApp(l.duenoTelefono ?? l.whatsapp, MENSAJES_WHATSAPP.adminAlDueno(l.duenoNombre, l.nombre));
        return (
          <li key={l.id} className="local-admin">
            <div className="local-admin-cabeza">
              <strong>{l.nombre}</strong>
              <span className={`estado estado--local-${l.estado}`}>{ESTADO_LOCAL_TEXTO[l.estado] ?? l.estado}</span>
            </div>
            <span className="meta">
              {l.distrito} · {l.canchas} {l.canchas === 1 ? "cancha" : "canchas"} · {futuras}
            </span>
            <span className="meta">
              Dueño:{" "}
              {l.sinDueno ? <strong>sin asignar (lo administra la plataforma)</strong> : `${l.duenoNombre} · ${l.duenoCorreo}`}
            </span>
            {l.estado === "suspended" && l.motivo && <span className="aviso aviso--error">Suspendido: {l.motivo}</span>}
            {aviso?.id === l.id && (
              <p className={`aviso ${aviso.error ? "aviso--error" : "aviso--ok"}`} role={aviso.error ? "alert" : "status"}>
                {aviso.texto}
              </p>
            )}

            {!aqui && (
              <div className="revision-botones">
                <Link className="boton boton--claro boton--chico" href={`/dueno/agenda?local=${l.id}`}>
                  Agenda
                </Link>
                <Link className="boton boton--claro boton--chico" href={`/dueno/configuracion?local=${l.id}`}>
                  Configurar
                </Link>
                {wsp && (
                  <a className="boton boton--wsp boton--chico" href={wsp} target="_blank" rel="noopener noreferrer">
                    WhatsApp al dueño
                  </a>
                )}
                <button type="button" className="boton boton--claro boton--chico" onClick={() => abrir(l.id, "dueno")}>
                  {l.sinDueno ? "Asignar dueño" : "Cambiar dueño"}
                </button>
                {l.estado === "approved" ? (
                  <button type="button" className="boton boton--claro boton--chico" onClick={() => abrir(l.id, "suspender")}>
                    Suspender
                  </button>
                ) : (
                  <button
                    type="button"
                    className="boton boton--naranja boton--chico"
                    disabled={enviando}
                    onClick={() => patch(l, { accion: "reactivar" }, () => `${l.nombre} vuelve a estar publicado en el mapa.`)}
                  >
                    Reactivar
                  </button>
                )}
              </div>
            )}

            {aqui === "dueno" && (
              <form
                className="form-agenda"
                onSubmit={(e: FormEvent) => {
                  e.preventDefault();
                  void patch(l, { accion: "asignar_dueno", correo }, (d) =>
                    `${l.nombre} ahora es de ${d.dueno} (${d.correo}).${d.ahoraEsDueno ? " Su cuenta pasó a ser de dueño." : ""} Al entrar verá el local en su panel.`,
                  );
                }}
              >
                <label className="form-agenda-ancho">
                  Correo de la cuenta del dueño
                  <input className="campo" type="email" required value={correo} autoFocus onChange={(e) => setCorreo(e.target.value)} />
                </label>
                <p className="meta form-agenda-ancho">La persona primero debe crear su cuenta en ReservaYa con ese correo.</p>
                <div className="revision-botones form-agenda-ancho">
                  <button type="submit" className="boton boton--naranja" disabled={enviando}>
                    {enviando ? "Guardando…" : "Asignar"}
                  </button>
                  <button type="button" className="boton boton--claro" onClick={() => setAbierto(null)}>
                    Cerrar
                  </button>
                </div>
              </form>
            )}

            {aqui === "suspender" && (
              <form
                className="form-agenda"
                onSubmit={(e: FormEvent) => {
                  e.preventDefault();
                  void patch(l, { accion: "suspender", motivo }, (d) =>
                    `${l.nombre} quedó suspendido: ya no aparece en el mapa.${Number(d.reservasFuturas) > 0 ? ` Tiene ${d.reservasFuturas} reservas pendientes que siguen en pie.` : ""}`,
                  );
                }}
              >
                <div className="chips form-agenda-ancho">
                  {MOTIVOS.map((m) => (
                    <button key={m} type="button" className="chip" aria-pressed={motivo === m} onClick={() => setMotivo(m)}>
                      {m}
                    </button>
                  ))}
                </div>
                <label className="form-agenda-ancho">
                  Motivo (lo verá el dueño)
                  <input className="campo" required minLength={3} maxLength={300} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
                </label>
                {l.reservasFuturas > 0 && (
                  <p className="aviso form-agenda-ancho">
                    Tiene {futuras}: seguirán en pie. El dueño puede atenderlas o cancelarlas desde su agenda.
                  </p>
                )}
                <div className="revision-botones form-agenda-ancho">
                  <button type="submit" className="boton boton--peligro" disabled={enviando || motivo.trim().length < 3}>
                    {enviando ? "Guardando…" : "Suspender local"}
                  </button>
                  <button type="button" className="boton boton--claro" onClick={() => setAbierto(null)}>
                    Volver
                  </button>
                </div>
              </form>
            )}
          </li>
        );
      })}
    </ul>
  );
}
