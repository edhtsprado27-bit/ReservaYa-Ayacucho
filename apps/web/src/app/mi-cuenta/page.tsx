import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import Cabecera from "@/components/Cabecera";
import BotonSalir from "@/components/cuenta/BotonSalir";
import { obtenerPerfil, ROL_TEXTO } from "@/lib/auth/perfil";

export const metadata: Metadata = { title: "Mi cuenta · ReservaYa Ayacucho" };

async function Contenido() {
  const perfil = await obtenerPerfil();
  if (!perfil) redirect("/login?next=/mi-cuenta");

  return (
    <>
      <div className="titulo">
        <h1>Mi cuenta</h1>
        <p>Hola, {perfil.nombre.split(" ")[0]}.</p>
      </div>

      <section className="panel" aria-labelledby="t-datos">
        <h2 id="t-datos">Tus datos</h2>
        <dl className="datos">
          <div>
            <dt>Nombre</dt>
            <dd>{perfil.nombre}</dd>
          </div>
          <div>
            <dt>Correo</dt>
            <dd>{perfil.email ?? "—"}</dd>
          </div>
          <div>
            <dt>Celular</dt>
            <dd>{perfil.telefono ?? "No registrado"}</dd>
          </div>
          <div>
            <dt>Tipo de cuenta</dt>
            <dd>
              <span className="etiqueta-rol">{ROL_TEXTO[perfil.rol]}</span>
            </dd>
          </div>
        </dl>
      </section>

      {perfil.rol === "jugador" && (
        <section className="panel" aria-labelledby="t-reservas">
          <h2 id="t-reservas">Mis reservas</h2>
          <p className="meta">Todavía no tienes reservas. Busca una cancha en el mapa para empezar.</p>
        </section>
      )}

      <div className="acciones-cuenta">
        {perfil.rol === "dueno" && (
          <Link className="boton" href="/dueno">
            Panel del dueño
          </Link>
        )}
        {perfil.rol === "admin" && (
          <Link className="boton" href="/admin">
            Panel del administrador
          </Link>
        )}
        <Link className="boton boton--claro" href="/">
          Ir al mapa
        </Link>
        <Link className="boton boton--claro" href="/nueva-clave">
          Cambiar contraseña
        </Link>
        <BotonSalir />
      </div>
    </>
  );
}

export default function MiCuentaPage() {
  return (
    <>
      <Cabecera />
      <main className="envoltura pagina-angosta">
        <Suspense fallback={<p className="meta">Cargando tu cuenta…</p>}>
          <Contenido />
        </Suspense>
      </main>
    </>
  );
}
