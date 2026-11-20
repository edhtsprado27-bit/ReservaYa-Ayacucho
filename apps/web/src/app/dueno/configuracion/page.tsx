// Configuración del local: /dueno/configuracion?local=<id>
// Reglas de reserva, contacto, canchas, horario por día y precios.
// Solo dueños (sus locales) y admin (todos). Los datos los arma la base (fn_config_local).

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import Cabecera from "@/components/Cabecera";
import ConfigLocal from "@/components/dueno/ConfigLocal";
import { crearClienteServidor } from "@/modules/compartido/infraestructura/supabase/cliente-servidor";
import { aErrorAplicacion } from "@/modules/compartido/infraestructura/supabase/traducir-error";
import { obtenerPerfil } from "@/modules/cuentas/infraestructura/perfil";
import { verConfiguracion, verMisLocales } from "@/modules/locales/aplicacion/locales.casos-de-uso";
import type { ConfigLocal as Config } from "@/modules/locales/dominio/configuracion";
import type { LocalPropio } from "@/modules/locales/dominio/locales.repositorio";
import { localesConSesion } from "@/modules/locales/infraestructura/composicion";

export const metadata: Metadata = { title: "Configurar local · Panel del dueño · ReservaYa Ayacucho" };

const texto = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);

async function Contenido({ searchParams }: PageProps<"/dueno/configuracion">) {
  const [sp, perfil] = await Promise.all([searchParams, obtenerPerfil()]);
  if (!perfil) redirect("/login?next=/dueno/configuracion");
  if (perfil.rol !== "dueno" && perfil.rol !== "admin") redirect("/mi-cuenta");

  const repo = localesConSesion(await crearClienteServidor());
  let locales: LocalPropio[] = [];
  let config: Config | null = null;
  let error: string | null = null;
  try {
    locales = await verMisLocales(repo);
    const localId = locales.find((l) => l.id === texto(sp.local))?.id ?? locales[0]?.id;
    if (localId) config = await verConfiguracion(repo, localId);
  } catch (e) {
    error = aErrorAplicacion(e).message;
  }

  if (error) return <p className="aviso aviso--error">{error}</p>;
  if (!config) {
    return (
      <p className="aviso">
        Todavía no tienes locales registrados. <Link href="/?agregar=1">Registra tu cancha</Link> y el administrador la
        revisará.
      </p>
    );
  }
  return <ConfigLocal key={config.local.id} config={config} locales={locales} />;
}

export default function ConfiguracionPage(props: PageProps<"/dueno/configuracion">) {
  return (
    <>
      <Cabecera />
      <main className="envoltura pagina-angosta">
        <nav className="migas">
          <Link href="/dueno">← Panel del dueño</Link>
        </nav>
        <div className="titulo">
          <h1>Configurar mi local</h1>
          <p>Precios, horario de atención y reglas para reservar. Los cambios se ven en la web al instante.</p>
        </div>
        <Suspense fallback={<p className="meta">Cargando tu local…</p>}>
          <Contenido {...props} />
        </Suspense>
      </main>
    </>
  );
}
