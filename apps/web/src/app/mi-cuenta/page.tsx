import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import Cabecera from "@/components/Cabecera";
import BotonSalir from "@/components/cuenta/BotonSalir";
import ListaReservas from "@/components/reservas/ListaReservas";
import { crearClienteServidor } from "@/modules/compartido/infraestructura/supabase/cliente-servidor";
import { aErrorAplicacion } from "@/modules/compartido/infraestructura/supabase/traducir-error";
import { obtenerPerfil, ROL_TEXTO } from "@/modules/cuentas/infraestructura/perfil";
import { verMisReservas } from "@/modules/reservas/aplicacion/reservas.casos-de-uso";
import type { Reserva } from "@/modules/reservas/dominio/reserva";
import { reservasConSesion } from "@/modules/reservas/infraestructura/composicion";

export const metadata: Metadata = { title: "Mi cuenta · ReservaYa Ayacucho" };

async function Contenido() {
  const perfil = await obtenerPerfil();
  if (!perfil) redirect("/login?next=/mi-cuenta");

  let reservas: Reserva[] = [];
  let errorReservas: string | null = null;
  try {
    reservas = await verMisReservas(reservasConSesion(await crearClienteServidor()));
  } catch (e) {
    errorReservas = aErrorAplicacion(e).message;
  }

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

      <section className="panel" id="mis-reservas" aria-labelledby="t-reservas">
        <h2 id="t-reservas">Mis reservas</h2>
        {errorReservas ? (
          <p className="aviso aviso--error">{errorReservas}</p>
        ) : reservas.length ? (
          <ListaReservas reservas={reservas} />
        ) : (
          <p className="meta">
            Todavía no tienes reservas. <Link href="/">Busca una cancha en el mapa</Link> y toca “Reservar”.
          </p>
        )}
      </section>

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
