// Agenda del dueño: /dueno/agenda?local=<id>&fecha=AAAA-MM-DD&cancha=<id>
// Solo dueños y admin. Los datos los arma la base (fn_agenda_local) con la
// sesión de quien pide; la página se actualiza sola cada minuto.

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import Cabecera from "@/components/Cabecera";
import AgendaDueno from "@/components/dueno/AgendaDueno";
import RefrescarCada from "@/components/reservas/RefrescarCada";
import { verAgenda, verLocalesConAgenda } from "@/modules/agenda/aplicacion/agenda.casos-de-uso";
import type { AgendaDia } from "@/modules/agenda/dominio/agenda";
import type { LocalDelDueno } from "@/modules/agenda/dominio/agenda.repositorio";
import { agendaConSesion } from "@/modules/agenda/infraestructura/composicion";
import { crearClienteServidor } from "@/modules/compartido/infraestructura/supabase/cliente-servidor";
import { aErrorAplicacion } from "@/modules/compartido/infraestructura/supabase/traducir-error";
import { obtenerPerfil } from "@/modules/cuentas/infraestructura/perfil";
import { esFechaValida, fechaLima } from "@/modules/reservas/dominio/tiempo";

export const metadata: Metadata = { title: "Agenda · Panel del dueño · ReservaYa Ayacucho" };

const texto = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);

async function Contenido({ searchParams }: PageProps<"/dueno/agenda">) {
  const [sp, perfil] = await Promise.all([searchParams, obtenerPerfil()]);
  if (!perfil) redirect("/login?next=/dueno/agenda");
  if (perfil.rol !== "dueno" && perfil.rol !== "admin") redirect("/mi-cuenta");

  const repo = agendaConSesion(await crearClienteServidor());
  const hoy = fechaLima();
  const pedida = texto(sp.fecha);
  const fecha = pedida && esFechaValida(pedida) ? pedida : hoy;

  let locales: LocalDelDueno[] = [];
  let agenda: AgendaDia | null = null;
  let error: string | null = null;
  try {
    locales = await verLocalesConAgenda(repo);
    const localId = locales.find((l) => l.id === texto(sp.local))?.id ?? locales[0]?.id;
    if (localId) agenda = await verAgenda(repo, localId, fecha);
  } catch (e) {
    error = aErrorAplicacion(e).message;
  }

  if (error) return <p className="aviso aviso--error">{error}</p>;
  if (!agenda) {
    return (
      <p className="aviso">
        Todavía no tienes canchas publicadas. Cuando el administrador apruebe tu cancha, aquí verás sus reservas.{" "}
        <Link href="/dueno">Volver al panel</Link>
      </p>
    );
  }

  return (
    <>
      <RefrescarCada segundos={60} />
      <AgendaDueno
        key={`${agenda.local.id}-${agenda.fecha}`}
        agenda={agenda}
        locales={locales}
        hoy={hoy}
        canchaInicial={texto(sp.cancha)}
      />
    </>
  );
}

export default function AgendaPage(props: PageProps<"/dueno/agenda">) {
  return (
    <>
      <Cabecera />
      <main className="envoltura pagina-angosta">
        <nav className="migas">
          <Link href="/dueno">← Panel del dueño</Link>
        </nav>
        <div className="titulo">
          <h1>Agenda de reservas</h1>
          <p>Mira quién juega cada hora, anota reservas por teléfono, cobra y cierra la cancha cuando haga falta.</p>
        </div>
        <Suspense fallback={<p className="meta">Cargando la agenda…</p>}>
          <Contenido {...props} />
        </Suspense>
      </main>
    </>
  );
}
