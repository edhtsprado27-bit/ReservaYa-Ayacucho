// Detalle de una reserva propia: código, horario, montos y tiempo para pagar.

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import Cabecera from "@/components/Cabecera";
import BotonCancelar from "@/components/reservas/BotonCancelar";
import CuentaRegresiva from "@/components/reservas/CuentaRegresiva";
import PagoAdelanto from "@/components/reservas/PagoAdelanto";
import RefrescarCada from "@/components/reservas/RefrescarCada";
import { distritoAWeb } from "@/modules/catalogo/dominio/cancha";
import { enlaceGoogleMaps } from "@/modules/catalogo/dominio/ubicacion";
import { enlaceWhatsApp, MENSAJES_WHATSAPP } from "@/modules/compartido/dominio/whatsapp";
import { crearClienteServidor } from "@/modules/compartido/infraestructura/supabase/cliente-servidor";
import { aErrorAplicacion } from "@/modules/compartido/infraestructura/supabase/traducir-error";
import { obtenerPerfil } from "@/modules/cuentas/infraestructura/perfil";
import { verEstadoPago } from "@/modules/pagos/aplicacion/pagos.casos-de-uso";
import { METODO_TEXTO, resultadoParaJugador, type EstadoPago } from "@/modules/pagos/dominio/pago";
import { pagosConSesion } from "@/modules/pagos/infraestructura/composicion";
import { verMisReservas } from "@/modules/reservas/aplicacion/reservas.casos-de-uso";
import { ESTADO_TEXTO, type Reserva } from "@/modules/reservas/dominio/reserva";
import { duracionTexto, rangoTexto, soles } from "@/modules/reservas/dominio/tiempo";
import { reservasConSesion } from "@/modules/reservas/infraestructura/composicion";

export const metadata: Metadata = { title: "Mi reserva · ReservaYa Ayacucho" };

async function Detalle({ params }: PageProps<"/reservas/[id]">) {
  const [{ id }, perfil] = await Promise.all([params, obtenerPerfil()]);
  if (!perfil) redirect(`/login?next=${encodeURIComponent(`/reservas/${id}`)}`);

  let reserva: Reserva | undefined;
  let pago: EstadoPago | null = null;
  try {
    const db = await crearClienteServidor();
    [[reserva], pago] = await Promise.all([verMisReservas(reservasConSesion(db), id), verEstadoPago(pagosConSesion(db).pagos, id)]);
  } catch (e) {
    return <p className="aviso aviso--error">{aErrorAplicacion(e).message}</p>;
  }
  if (!reserva) {
    return (
      <div className="titulo">
        <h1>No encontramos esta reserva</h1>
        <p>
          No está en tu cuenta. <Link href="/mi-cuenta">Ver mis reservas</Link>
        </p>
      </div>
    );
  }

  const r = reserva;
  const pagado = r.pagado > 0 ? r.pagado : r.adelanto;
  const saldo = Math.max(0, Math.round((r.total - pagado) * 100) / 100);
  const telefono = r.telefono?.replace(/\D/g, "");
  const whatsapp = enlaceWhatsApp(r.telefono, MENSAJES_WHATSAPP.sobreReserva(r.codigo, r.cancha, rangoTexto(r.inicio, r.fin)));
  const otraHora = `/cancha/${r.slug}`;

  return (
    <>
      <div className="titulo">
        <h1>Reserva {r.codigo}</h1>
        <p>
          {r.local} · {r.cancha}
        </p>
      </div>

      <section className="panel ticket" aria-labelledby="t-reserva">
        <div className="ticket-cabeza">
          <h2 id="t-reserva">{rangoTexto(r.inicio, r.fin)}</h2>
          <span className={`estado estado--${r.estado}`}>{ESTADO_TEXTO[r.estado]}</span>
        </div>
        <dl className="datos">
          <div>
            <dt>Duración</dt>
            <dd>{duracionTexto(r.inicio, r.fin)}</dd>
          </div>
          <div>
            <dt>Cancha</dt>
            <dd>
              {r.cancha} · {r.deporte}
            </dd>
          </div>
          <div>
            <dt>Dirección</dt>
            <dd>
              {r.direccion}, {distritoAWeb(r.distrito)}
              {r.referencia ? ` (${r.referencia})` : ""}
            </dd>
          </div>
          <div>
            <dt>Código</dt>
            <dd>
              <span className="codigo">{r.codigo}</span> · muéstralo al llegar
            </dd>
          </div>
        </dl>
        <div className="montos">
          <div>
            <span>Total</span>
            <strong>{soles(r.total)}</strong>
          </div>
          <div>
            <span>{r.pagado > 0 ? "Adelanto pagado" : "Adelanto"}</span>
            <strong>{soles(pagado)}</strong>
          </div>
          <div>
            <span>Pagas en el local</span>
            <strong>{soles(saldo)}</strong>
          </div>
        </div>
      </section>

      {r.estado === "pending_payment" && r.vence && (
        <section className="panel panel--pago" aria-label="Pago del adelanto">
          <CuentaRegresiva vence={r.vence} />
          <p>
            El horario está apartado para ti. Paga el adelanto antes de que termine el tiempo; si no, se libera para
            otra persona.
          </p>
          <PagoAdelanto
            reservaId={r.id}
            adelanto={r.adelanto}
            yape={pago?.yape ?? null}
            plin={pago?.plin ?? null}
            titular={pago?.titular ?? null}
            telefonoLocal={r.telefono}
            rechazo={pago?.pago?.estado === "rejected" ? (pago.pago.motivo ?? "sin motivo") : null}
          />
        </section>
      )}
      {r.estado === "payment_review" && (
        <section className="panel panel--revision" aria-label="Pago en revisión">
          <RefrescarCada segundos={20} />
          <h2>Recibimos tu comprobante</h2>
          {pago?.pago?.leido && (
            <p>
              Leímos: {pago.pago.leido.app ? `${METODO_TEXTO[pago.pago.metodo]} · ` : ""}
              {pago.pago.leido.monto != null ? soles(pago.pago.leido.monto) : "monto no visible"}
              {pago.pago.leido.operacion ? ` · operación ${pago.pago.leido.operacion}` : ""}
            </p>
          )}
          <p>{resultadoParaJugador(pago?.pago?.resultado ?? null, pago?.pago?.leido ?? null, r.adelanto)}</p>
          <p className="meta">
            Tu horario sigue apartado mientras el local revisa su {pago?.pago ? METODO_TEXTO[pago.pago.metodo] : "cuenta"}.
            Esta página se actualiza sola.
          </p>
        </section>
      )}
      {r.estado === "confirmed" && (
        <section className="panel panel--confirmada" aria-label="Reserva confirmada">
          <h2>¡Reserva confirmada!</h2>
          <p>
            Pagaste {soles(r.pagado)}
            {pago?.pago ? ` por ${METODO_TEXTO[pago.pago.metodo]}` : ""}. El día del partido muestra tu código{" "}
            <span className="codigo">{r.codigo}</span> y paga el resto en el local.
          </p>
        </section>
      )}
      {r.estado === "expired" && (
        <p className="aviso">
          Este apartado venció porque no se pagó a tiempo, y el horario se liberó.{" "}
          <Link href={otraHora}>Reservar de nuevo</Link>
        </p>
      )}
      {r.estado === "cancelled" && (
        <p className="aviso">
          {r.canceladaPorLocal
            ? `El local canceló esta reserva${r.motivoCancelacion ? `: “${r.motivoCancelacion}”` : ""}. Si ya pagaste, coordina la devolución con el local.`
            : "Cancelaste esta reserva."}{" "}
          <Link href={otraHora}>Reservar otra hora</Link>
        </p>
      )}

      <div className="acciones-cuenta">
        {r.lat != null && r.lng != null && (
          <a
            className="boton"
            href={enlaceGoogleMaps({ lat: r.lat, lng: r.lng })}
            target="_blank"
            rel="noopener noreferrer"
          >
            Cómo llegar
          </a>
        )}
        {whatsapp && (
          <a className="boton boton--wsp" href={whatsapp} target="_blank" rel="noopener noreferrer">
            Escribir al local
          </a>
        )}
        {telefono && (
          <a className="boton boton--claro" href={`tel:${telefono}`}>
            Llamar al local
          </a>
        )}
        <Link className="boton boton--claro" href="/mi-cuenta#mis-reservas">
          Mis reservas
        </Link>
        {r.cancelable && (
          <BotonCancelar
            id={r.id}
            inicio={r.inicio}
            horasCancelacion={r.horasCancelacion}
            conPago={r.estado !== "pending_payment"}
          />
        )}
      </div>
    </>
  );
}

export default function ReservaPage(props: PageProps<"/reservas/[id]">) {
  return (
    <>
      <Cabecera />
      <main className="envoltura pagina-angosta">
        <Suspense fallback={<p className="meta">Cargando tu reserva…</p>}>
          <Detalle {...props} />
        </Suspense>
      </main>
    </>
  );
}
