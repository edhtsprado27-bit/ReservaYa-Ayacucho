import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import Cabecera from "@/components/Cabecera";
import { obtenerPerfil } from "@/lib/auth/perfil";
import { crearClienteServidor } from "@/lib/auth/servidor";
import { listarPendientes } from "@/lib/catalogo-servidor";

export const metadata: Metadata = { title: "Panel del dueño · ReservaYa Ayacucho" };

type Publicada = { id: string; name: string; address: string; districts: { name: string } | null };

async function Contenido() {
  const perfil = await obtenerPerfil();
  if (!perfil) redirect("/login?next=/dueno");
  if (perfil.rol !== "dueno" && perfil.rol !== "admin") redirect("/mi-cuenta");

  const db = await crearClienteServidor();
  const [pendientes, publicadas] = await Promise.all([
    listarPendientes(db).catch(() => []),
    db
      .from("venues")
      .select("id, name, address, districts(name)")
      .eq("owner_id", perfil.id)
      .eq("status", "approved")
      .order("name")
      .then(({ data }) => (data ?? []) as unknown as Publicada[]),
  ]);

  return (
    <>
      <div className="acciones-cuenta">
        <Link className="boton boton--naranja" href="/?agregar=1">
          + Registrar una cancha
        </Link>
      </div>

      <section className="panel" aria-labelledby="t-publicadas">
        <h2 id="t-publicadas">Publicadas ({publicadas.length})</h2>
        {publicadas.length === 0 ? (
          <p className="meta">Aún no tienes canchas publicadas.</p>
        ) : (
          <ul className="lista-simple">
            {publicadas.map((v) => (
              <li key={v.id}>
                <strong>{v.name}</strong>
                <span className="meta">
                  {v.districts?.name} · {v.address}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="panel" aria-labelledby="t-revision">
        <h2 id="t-revision">En revisión ({pendientes.length})</h2>
        {pendientes.length === 0 ? (
          <p className="meta">No tienes canchas esperando aprobación.</p>
        ) : (
          <ul className="lista-simple">
            {pendientes.map((c) => (
              <li key={c.id}>
                <strong>{c.nombre}</strong>
                <span className="meta">
                  {c.distrito} · {c.direccion}
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="meta">El administrador revisa cada cancha antes de publicarla en el mapa.</p>
      </section>
    </>
  );
}

export default function DuenoPage() {
  return (
    <>
      <Cabecera />
      <main className="envoltura pagina-angosta">
        <div className="titulo">
          <h1>Panel del dueño</h1>
          <p>Registra tus canchas y revisa su estado.</p>
        </div>
        <Suspense fallback={<p className="meta">Cargando tus canchas…</p>}>
          <Contenido />
        </Suspense>
      </main>
    </>
  );
}
