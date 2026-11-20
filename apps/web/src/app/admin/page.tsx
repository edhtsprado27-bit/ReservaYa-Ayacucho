import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import Cabecera from "@/components/Cabecera";
import LocalesAdmin from "@/components/admin/LocalesAdmin";
import ListaRevision from "@/components/cuenta/ListaRevision";
import { obtenerPerfil } from "@/modules/cuentas/infraestructura/perfil";
import { crearClienteServidor } from "@/modules/compartido/infraestructura/supabase/cliente-servidor";
import { verPendientes } from "@/modules/catalogo/aplicacion/catalogo.casos-de-uso";
import { catalogoConSesion } from "@/modules/catalogo/infraestructura/composicion";
import { aErrorAplicacion } from "@/modules/compartido/infraestructura/supabase/traducir-error";
import { verLocalesAdmin } from "@/modules/locales/aplicacion/locales.casos-de-uso";
import type { LocalAdmin } from "@/modules/locales/dominio/configuracion";
import { localesConSesion } from "@/modules/locales/infraestructura/composicion";

export const metadata: Metadata = { title: "Administrador · ReservaYa Ayacucho" };

async function Contenido() {
  const perfil = await obtenerPerfil();
  if (!perfil) redirect("/login?next=/admin");
  if (perfil.rol !== "admin") redirect("/mi-cuenta");

  const db = await crearClienteServidor();
  const [pendientes, resultado] = await Promise.all([
    verPendientes(catalogoConSesion(db)).catch(() => []),
    verLocalesAdmin(localesConSesion(db)).then(
      (locales: LocalAdmin[]) => ({ locales, errorLocales: null }),
      (e: unknown) => ({ locales: [] as LocalAdmin[], errorLocales: aErrorAplicacion(e).message }),
    ),
  ]);
  const { locales, errorLocales } = resultado;
  return (
    <>
      <section className="panel" aria-labelledby="t-por-aprobar">
        <h2 id="t-por-aprobar">Canchas por aprobar ({pendientes.length})</h2>
        <ListaRevision inicial={pendientes} />
      </section>
      <section className="panel" aria-labelledby="t-locales">
        <h2 id="t-locales">Locales publicados ({locales.length})</h2>
        <p className="meta">Asigna cada local a la cuenta de su dueño real, o suspende uno si hay un problema.</p>
        {errorLocales ? <p className="aviso aviso--error">{errorLocales}</p> : <LocalesAdmin locales={locales} />}
      </section>
    </>
  );
}

export default function AdminPage() {
  return (
    <>
      <Cabecera />
      <main className="envoltura pagina-angosta">
        <div className="titulo">
          <h1>Panel del administrador</h1>
          <p>Revisa las canchas antes de publicarlas en el mapa y administra los locales publicados.</p>
        </div>
        <Suspense fallback={<p className="meta">Cargando canchas por aprobar…</p>}>
          <Contenido />
        </Suspense>
      </main>
    </>
  );
}
