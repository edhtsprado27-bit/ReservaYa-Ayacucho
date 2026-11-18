import { Suspense } from "react";
import BuscadorCanchas from "@/components/BuscadorCanchas";
import Cabecera from "@/components/Cabecera";
import { obtenerPerfil } from "@/lib/auth/perfil";

// Depende de quién inició sesión (para "+ Agregar cancha"): se carga aparte
async function Buscador({ searchParams }: { searchParams: PageProps<"/">["searchParams"] }) {
  const [perfil, sp] = await Promise.all([obtenerPerfil(), searchParams]);
  return <BuscadorCanchas perfil={perfil} abrirAgregar={sp.agregar === "1"} />;
}

export default function Home({ searchParams }: PageProps<"/">) {
  return (
    <>
      <Cabecera />
      <main className="envoltura">
        <div className="titulo">
          <h1>Encuentra tu cancha en Huamanga</h1>
          <p>Toca una cancha en el mapa o en la lista para ver cómo llegar.</p>
        </div>
        <Suspense fallback={<div className="mapa mapa--cargando">Cargando canchas…</div>}>
          <Buscador searchParams={searchParams} />
        </Suspense>
      </main>
    </>
  );
}
