import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import Cabecera from "@/components/Cabecera";
import ListaRevision from "@/components/cuenta/ListaRevision";
import { obtenerPerfil } from "@/lib/auth/perfil";
import { crearClienteServidor } from "@/lib/auth/servidor";
import { listarPendientes } from "@/lib/catalogo-servidor";

export const metadata: Metadata = { title: "Administrador · ReservaYa Ayacucho" };

async function Contenido() {
  const perfil = await obtenerPerfil();
  if (!perfil) redirect("/login?next=/admin");
  if (perfil.rol !== "admin") redirect("/mi-cuenta");

  const pendientes = await listarPendientes(await crearClienteServidor()).catch(() => []);
  return (
    <section className="panel" aria-labelledby="t-por-aprobar">
      <h2 id="t-por-aprobar">Canchas por aprobar ({pendientes.length})</h2>
      <ListaRevision inicial={pendientes} />
    </section>
  );
}

export default function AdminPage() {
  return (
    <>
      <Cabecera />
      <main className="envoltura pagina-angosta">
        <div className="titulo">
          <h1>Panel del administrador</h1>
          <p>Revisa las canchas antes de publicarlas en el mapa.</p>
        </div>
        <Suspense fallback={<p className="meta">Cargando canchas por aprobar…</p>}>
          <Contenido />
        </Suspense>
      </main>
    </>
  );
}
