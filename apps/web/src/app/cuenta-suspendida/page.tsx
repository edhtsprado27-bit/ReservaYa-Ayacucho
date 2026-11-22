// Cuenta suspendida por el administrador (RF08): se explica el motivo y cómo
// pedir ayuda por WhatsApp (RF15). La persona no puede reservar ni usar su
// panel mientras siga suspendida (lo bloquea la base con fn_usuario_actual).

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import Cabecera from "@/components/Cabecera";
import BotonSalir from "@/components/cuenta/BotonSalir";
import { enlaceWhatsApp, MENSAJES_WHATSAPP } from "@/modules/compartido/dominio/whatsapp";
import { obtenerCuenta } from "@/modules/cuentas/infraestructura/perfil";
import { ajustesPublicos } from "@/modules/soporte/infraestructura/composicion";

export const metadata: Metadata = { title: "Cuenta suspendida · ReservaYa Ayacucho" };

async function Contenido() {
  const { perfil, suspension } = await obtenerCuenta();
  if (perfil) redirect("/mi-cuenta"); // ya la reactivaron
  if (!suspension) redirect("/login");

  const { whatsappSoporte } = await ajustesPublicos();
  const ayuda = enlaceWhatsApp(whatsappSoporte, MENSAJES_WHATSAPP.cuentaSuspendida(suspension.nombre));
  return (
    <>
      <div className="titulo">
        <h1>Tu cuenta está suspendida</h1>
        <p>Mientras siga así no puedes hacer reservas ni usar tu panel.</p>
      </div>
      <section className="panel" aria-labelledby="t-motivo">
        <h2 id="t-motivo">Motivo</h2>
        <p className="aviso aviso--error">{suspension.motivo ?? "El administrador no indicó un motivo."}</p>
        <p className="meta">
          Si crees que es un error, escríbenos y lo revisamos. Tus reservas siguen registradas: si ya pagaste alguna, coordínala con el local.
        </p>
      </section>
      <div className="acciones-cuenta">
        {ayuda && (
          <a className="boton boton--wsp" href={ayuda} target="_blank" rel="noopener noreferrer">
            Escribir al administrador por WhatsApp
          </a>
        )}
        <Link className="boton boton--claro" href="/">
          Ir al mapa
        </Link>
        <BotonSalir />
      </div>
    </>
  );
}

export default function CuentaSuspendidaPage() {
  return (
    <>
      <Cabecera />
      <main className="envoltura pagina-angosta">
        <Suspense fallback={<p className="meta">Cargando…</p>}>
          <Contenido />
        </Suspense>
      </main>
    </>
  );
}
