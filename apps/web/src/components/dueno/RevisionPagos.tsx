"use client";

// Pagos por revisar (panel del dueño y del admin).
// La IA ayuda leyendo la captura; quien confirma es el dueño, revisando que el
// dinero llegó a su Yape o Plin.

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  celularTexto,
  METODO_TEXTO,
  RESULTADO_CORTO,
  type PagoPorRevisar,
} from "@/modules/pagos/dominio/pago";
import { enlaceWhatsApp, MENSAJES_WHATSAPP } from "@/modules/compartido/dominio/whatsapp";
import { fechaLarga, horaLima, soles } from "@/modules/reservas/dominio/tiempo";

const MOTIVOS = ["No me llegó el pago", "El monto está incompleto", "La captura no es válida"];

function Lectura({ p }: { p: PagoPorRevisar }) {
  if (!p.resultado) {
    return <p className="meta">Sin lectura automática: revisa la captura a mano.</p>;
  }
  const l = p.leido;
  return (
    <div className="lectura-ia">
      <span className={`resultado resultado--${p.resultado}`}>
        {p.resultado === "match" ? "✓ " : "⚠ "}
        IA: {RESULTADO_CORTO[p.resultado]}
      </span>
      <span className="meta">
        Leído: {l?.monto != null ? soles(l.monto) : "monto no visible"}
        {l?.operacion ? ` · Op. ${l.operacion}` : ""}
        {l?.destinatario ? ` · ${l.destinatario}` : ""}
        {l?.fecha ? ` · ${fechaLarga(l.fecha)} ${horaLima(l.fecha)}` : ""}
      </span>
    </div>
  );
}

export default function RevisionPagos({ inicial }: { inicial: PagoPorRevisar[] }) {
  const router = useRouter();
  const [lista, setLista] = useState(inicial);
  const [trabajando, setTrabajando] = useState<string | null>(null);
  const [rechazando, setRechazando] = useState<string | null>(null);
  const [motivo, setMotivo] = useState("");
  const [aviso, setAviso] = useState<{ error: boolean; texto: string } | null>(null);

  async function revisar(p: PagoPorRevisar, accion: "confirmar" | "rechazar") {
    setTrabajando(p.pagoId);
    setAviso(null);
    const res = await fetch(`/api/pagos/${p.pagoId}/revisar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accion, motivo: accion === "rechazar" ? motivo : undefined }),
    }).catch(() => null);
    const json = await res?.json().catch(() => null);
    setTrabajando(null);
    if (!json?.ok) {
      setAviso({ error: true, texto: json?.error ?? "Sin conexión con el servidor." });
      if (json?.codigo === "PAGO_YA_REVISADO") router.refresh();
      return;
    }
    setLista((l) => l.filter((x) => x.pagoId !== p.pagoId));
    setRechazando(null);
    setMotivo("");
    setAviso({
      error: false,
      texto:
        accion === "confirmar"
          ? `Reserva ${p.codigo} confirmada.`
          : `Pago de ${p.codigo} rechazado. El jugador tiene unos minutos para enviar otra captura.`,
    });
    router.refresh();
  }

  return (
    <>
      {aviso && (
        <p className={`aviso${aviso.error ? " aviso--error" : ""}`} role="status">
          {aviso.texto}
        </p>
      )}
      {lista.length === 0 ? (
        <p className="meta">No hay pagos esperando tu revisión.</p>
      ) : (
        <ul className="lista-revision">
          {lista.map((p) => {
            const cuenta = p.metodo === "yape" ? p.yape : p.plin;
            return (
              <li key={p.pagoId} className="tarjeta-pago">
                {p.imagen ? (
                  <a href={p.imagen} target="_blank" rel="noopener noreferrer" className="miniatura">
                    {/* eslint-disable-next-line @next/next/no-img-element -- enlace firmado de Supabase que vence en 15 min */}
                    <img src={p.imagen} alt={`Captura del pago de ${p.codigo}`} />
                    <span>Ver grande</span>
                  </a>
                ) : (
                  <div className="miniatura miniatura--vacia">Sin imagen</div>
                )}
                <div className="tarjeta-pago-datos">
                  <strong>
                    {p.codigo} · {fechaLarga(p.inicio)} · {horaLima(p.inicio)}–{horaLima(p.fin)}
                  </strong>
                  <span className="meta">
                    {p.local} · {p.cancha}
                  </span>
                  <span className="meta">
                    {p.jugador ?? "Jugador"}
                    {p.telefonoJugador ? (
                      <>
                        {" · "}
                        <a href={`tel:${p.telefonoJugador}`}>{celularTexto(p.telefonoJugador)}</a>
                        {enlaceWhatsApp(p.telefonoJugador) && (
                          <>
                            {" · "}
                            <a
                              className="enlace-wsp"
                              href={enlaceWhatsApp(p.telefonoJugador, MENSAJES_WHATSAPP.pagoAlJugador(p.jugador, p.local, p.codigo)) ?? undefined}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              WhatsApp
                            </a>
                          </>
                        )}
                      </>
                    ) : null}
                  </span>
                  <span>
                    Adelanto esperado <strong>{soles(p.adelanto)}</strong> por {METODO_TEXTO[p.metodo]}
                    {cuenta ? ` al ${celularTexto(cuenta)}` : ""}
                  </span>
                  <Lectura p={p} />
                  <p className="meta letra-chica">
                    Antes de confirmar, abre tu {METODO_TEXTO[p.metodo]} y busca
                    {p.operacion ? ` la operación ${p.operacion}` : " el pago"} por {soles(p.adelanto)}.
                  </p>
                  {rechazando === p.pagoId ? (
                    <div className="revision-rechazo">
                      <div className="chips">
                        {MOTIVOS.map((m) => (
                          <button key={m} type="button" className="chip" aria-pressed={motivo === m} onClick={() => setMotivo(m)}>
                            {m}
                          </button>
                        ))}
                      </div>
                      <label>
                        Motivo (lo verá el jugador)
                        <input
                          className="campo"
                          value={motivo}
                          maxLength={200}
                          onChange={(e) => setMotivo(e.target.value)}
                          placeholder="Ej.: No me llegó el pago"
                        />
                      </label>
                      <div className="revision-botones">
                        <button
                          type="button"
                          className="boton boton--peligro"
                          disabled={trabajando === p.pagoId || motivo.trim().length < 3}
                          onClick={() => revisar(p, "rechazar")}
                        >
                          Rechazar pago
                        </button>
                        <button type="button" className="boton boton--claro" onClick={() => setRechazando(null)}>
                          Volver
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="revision-botones">
                      <button
                        type="button"
                        className="boton boton--naranja"
                        disabled={trabajando === p.pagoId}
                        onClick={() => revisar(p, "confirmar")}
                      >
                        {trabajando === p.pagoId ? "Guardando…" : "Confirmar pago"}
                      </button>
                      <button
                        type="button"
                        className="boton boton--claro"
                        disabled={trabajando === p.pagoId}
                        onClick={() => {
                          setRechazando(p.pagoId);
                          setMotivo("");
                        }}
                      >
                        Rechazar
                      </button>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
