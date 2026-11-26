import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import Cabecera from "@/components/Cabecera";
import AjustesSoporte from "@/components/admin/AjustesSoporte";
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
import { ajustesPublicos } from "@/modules/soporte/infraestructura/composicion";
import { leerUsoIAHoy } from "@/modules/asistente/infraestructura/supabase-control-ia";

export const metadata: Metadata = { title: "Administrador · ReservaYa Ayacucho" };

async function Contenido() {
  const perfil = await obtenerPerfil();
  if (!perfil) redirect("/login?next=/admin");
  if (perfil.rol !== "admin") redirect("/mi-cuenta");

  const db = await crearClienteServidor();
  const [pendientes, resultado, ajustes, usoIA] = await Promise.all([
    verPendientes(catalogoConSesion(db)).catch(() => []),
    verLocalesAdmin(localesConSesion(db)).then(
      (locales: LocalAdmin[]) => ({ locales, errorLocales: null }),
      (e: unknown) => ({ locales: [] as LocalAdmin[], errorLocales: aErrorAplicacion(e).message }),
    ),
    ajustesPublicos(),
    leerUsoIAHoy(db).catch(() => null),
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
      <section className="panel" aria-labelledby="t-usuarios">
        <Link className="enlace-panel" href="/admin/usuarios">
          <div>
            <h2 id="t-usuarios">Usuarios</h2>
            <p className="meta">Busca cuentas, cambia entre jugador y dueño, suspende o reactiva.</p>
          </div>
          <strong aria-hidden="true">Gestionar →</strong>
        </Link>
      </section>
      <section className="panel" aria-labelledby="t-ayuda">
        <h2 id="t-ayuda">WhatsApp de ayuda</h2>
        <p className="meta">Sale en el botón “Ayuda” de todas las páginas para que jugadores y dueños te escriban.</p>
        <AjustesSoporte whatsappSoporte={ajustes.whatsappSoporte} />
      </section>
      {usoIA && (
        <section className="panel" aria-labelledby="t-ia">
          <h2 id="t-ia">Uso de la IA hoy</h2>
          <ul className="uso-ia">
            <li>
              <strong>{usoIA.asistente}</strong> de {usoIA.limiteAsistente} consultas del asistente
              {usoIA.asistenteFallidos ? ` (${usoIA.asistenteFallidos} sin respuesta de la IA)` : ""}
            </li>
            <li>
              <strong>{usoIA.comprobantes}</strong> {usoIA.comprobantes === 1 ? "comprobante leído" : "comprobantes leídos"}
            </li>
          </ul>
          <p className="meta">
            Los modelos gratis de OpenRouter permiten {usoIA.limiteOpenRouter} pedidos por día entre las dos funciones. El día se cuenta en
            hora UTC: se reinicia a las 7:00 p. m. de Ayacucho.
          </p>
        </section>
      )}
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
          <p>Revisa las canchas antes de publicarlas, administra los locales y las cuentas, y configura el WhatsApp de ayuda.</p>
        </div>
        <Suspense fallback={<p className="meta">Cargando canchas por aprobar…</p>}>
          <Contenido />
        </Suspense>
      </main>
    </>
  );
}
