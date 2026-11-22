// Página de un local: datos, servicios, cómo llegar, WhatsApp y la grilla para reservar.
// /cancha/<slug>?fecha=AAAA-MM-DD&cancha=<id>&desde=HH:MM&hasta=HH:MM (lo último es opcional)

import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import Cabecera from "@/components/Cabecera";
import ReservaCancha from "@/components/reservas/ReservaCancha";
import { distritoAWeb } from "@/modules/catalogo/dominio/cancha";
import { nombreServicio } from "@/modules/catalogo/dominio/servicios";
import { enlaceGoogleMaps, enlaceWaze } from "@/modules/catalogo/dominio/ubicacion";
import { enlaceWhatsApp, MENSAJES_WHATSAPP } from "@/modules/compartido/dominio/whatsapp";
import { aErrorAplicacion } from "@/modules/compartido/infraestructura/supabase/traducir-error";
import { obtenerPerfil } from "@/modules/cuentas/infraestructura/perfil";
import { verLocal } from "@/modules/reservas/aplicacion/reservas.casos-de-uso";
import type { LocalPublico } from "@/modules/reservas/dominio/reserva";
import { fechaLima } from "@/modules/reservas/dominio/tiempo";
import { reservasPublicas } from "@/modules/reservas/infraestructura/composicion";

export const metadata: Metadata = { title: "Reservar cancha · ReservaYa Ayacucho" };

const texto = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);

async function Ficha({ params, searchParams }: PageProps<"/cancha/[slug]">) {
  const [{ slug }, sp, perfil] = await Promise.all([params, searchParams, obtenerPerfil()]);

  let local: LocalPublico | null;
  try {
    local = await verLocal(reservasPublicas(), slug);
  } catch (e) {
    return <p className="aviso aviso--error">{aErrorAplicacion(e).message}</p>;
  }
  if (!local) {
    return (
      <div className="titulo">
        <h1>No encontramos esta cancha</h1>
        <p>
          Puede que todavía esté en revisión o que ya no esté publicada. <Link href="/">Volver al mapa</Link>
        </p>
      </div>
    );
  }

  const telefono = local.telefono?.replace(/\D/g, "");
  const whatsapp = enlaceWhatsApp(local.telefono, MENSAJES_WHATSAPP.consultaLocal(local.nombre));
  return (
    <>
      <div className="titulo">
        <h1>{local.nombre}</h1>
        <p>
          {distritoAWeb(local.distrito)} · {local.direccion}
          {local.referencia ? ` (${local.referencia})` : ""}
        </p>
      </div>
      {local.servicios.length > 0 && (
        <section className="ficha-servicios" aria-labelledby="t-servicios">
          <h2 id="t-servicios">Servicios del local</h2>
          <ul className="servicios">
            {local.servicios.map((s) => (
              <li key={s}>{nombreServicio(s)}</li>
            ))}
          </ul>
        </section>
      )}
      <div className="ficha-acciones">
        {whatsapp && (
          <a className="boton boton--wsp" href={whatsapp} target="_blank" rel="noopener noreferrer">
            Escribir por WhatsApp
          </a>
        )}
        <a className="boton boton--claro" href={enlaceGoogleMaps(local)} target="_blank" rel="noopener noreferrer">
          Cómo llegar
        </a>
        <a className="boton boton--claro" href={enlaceWaze(local)} target="_blank" rel="noopener noreferrer">
          Waze
        </a>
        {telefono && (
          <a className="boton boton--claro" href={`tel:${telefono}`}>
            Llamar al {local.telefono}
          </a>
        )}
      </div>
      <ReservaCancha
        local={local}
        conSesion={!!perfil}
        hoy={fechaLima()}
        inicial={{ fecha: texto(sp.fecha), cancha: texto(sp.cancha), desde: texto(sp.desde), hasta: texto(sp.hasta) }}
      />
    </>
  );
}

export default function CanchaPage(props: PageProps<"/cancha/[slug]">) {
  return (
    <>
      <Cabecera />
      <main className="envoltura pagina-angosta">
        <nav className="migas">
          <Link href="/">← Volver al mapa</Link>
        </nav>
        <Suspense fallback={<p className="meta">Cargando cancha…</p>}>
          <Ficha {...props} />
        </Suspense>
      </main>
    </>
  );
}
