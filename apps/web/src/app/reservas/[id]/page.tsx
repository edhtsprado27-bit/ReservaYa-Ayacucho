// Detalle de una reserva propia: código, horario, montos y tiempo para pagar.

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import Cabecera from "@/components/Cabecera";
import BotonCancelar from "@/components/reservas/BotonCancelar";
import CuentaRegresiva from "@/components/reservas/CuentaRegresiva";
import { enlaceGoogleMaps } from "@/data/canchas";
import { obtenerPerfil } from "@/lib/auth/perfil";
import { crearClienteServidor } from "@/lib/auth/servidor";
import { distritoAWeb } from "@/lib/canchas-db";
import { aErrorCatalogo } from "@/lib/catalogo-servidor";
import { ESTADO_TEXTO, duracionTexto, rangoTexto, soles, type Reserva } from "@/lib/reservas";
import { misReservas } from "@/lib/reservas-servidor";

export const metadata: Metadata = { title: "Mi reserva · ReservaYa Ayacucho" };

async function Detalle({ params }: PageProps<"/reservas/[id]">) {
  const [{ id }, perfil] = await Promise.all([params, obtenerPerfil()]);
  if (!perfil) redirect(`/login?next=${encodeURIComponent(`/reservas/${id}`)}`);

  let reserva: Reserva | undefined;
  try {
    [reserva] = await misReservas(await crearClienteServidor(), id);
  } catch (e) {
    return <p className="aviso aviso--error">{aErrorCatalogo(e).message}</p>;
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
  const saldo = Math.max(0, Math.round((r.total - r.adelanto) * 100) / 100);
  const telefono = r.telefono?.replace(/\D/g, "");
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
            <span>Adelanto</span>
            <strong>{soles(r.adelanto)}</strong>
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
            El horario está apartado para ti. Paga el adelanto de <strong>{soles(r.adelanto)}</strong> antes de que
            termine el tiempo; si no, se libera para otra persona.
          </p>
          <p className="meta">
            Muy pronto podrás pagar con Yape o Plin aquí mismo. Mientras tanto, coordina el adelanto con el local
            {r.telefono ? ` al ${r.telefono}` : ""}.
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
          Cancelaste esta reserva. <Link href={otraHora}>Reservar otra hora</Link>
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
