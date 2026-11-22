// Usuarios: /admin/usuarios?buscar=<texto>&filtro=todos|jugadores|duenos|admins|suspendidos
// Solo el administrador. Los datos los arma la base (fn_usuarios_admin, 012).

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import Cabecera from "@/components/Cabecera";
import UsuariosAdmin from "@/components/admin/UsuariosAdmin";
import { crearClienteServidor } from "@/modules/compartido/infraestructura/supabase/cliente-servidor";
import { aErrorAplicacion } from "@/modules/compartido/infraestructura/supabase/traducir-error";
import { obtenerPerfil } from "@/modules/cuentas/infraestructura/perfil";
import { verUsuarios } from "@/modules/usuarios/aplicacion/usuarios.casos-de-uso";
import { instanteActual, leerBusqueda, type UsuarioAdmin } from "@/modules/usuarios/dominio/usuarios";
import { usuariosConSesion } from "@/modules/usuarios/infraestructura/composicion";

export const metadata: Metadata = { title: "Usuarios · Administrador · ReservaYa Ayacucho" };

const texto = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);

async function Contenido({ searchParams }: PageProps<"/admin/usuarios">) {
  const [sp, perfil] = await Promise.all([searchParams, obtenerPerfil()]);
  if (!perfil) redirect("/login?next=/admin/usuarios");
  if (perfil.rol !== "admin") redirect("/mi-cuenta");

  const busqueda = leerBusqueda(texto(sp.buscar), texto(sp.filtro));
  const db = await crearClienteServidor();
  const { usuarios, error } = await verUsuarios(usuariosConSesion(db), busqueda.buscar, busqueda.filtro).then(
    (usuarios: UsuarioAdmin[]) => ({ usuarios, error: null }),
    (e: unknown) => ({ usuarios: [] as UsuarioAdmin[], error: aErrorAplicacion(e).message }),
  );
  // key: al cambiar la búsqueda se arma de nuevo (el cuadro de texto toma el valor de la URL)
  return (
    <UsuariosAdmin
      key={`${busqueda.buscar ?? ""}|${busqueda.filtro}`}
      usuarios={usuarios}
      busqueda={busqueda}
      ahora={instanteActual()}
      error={error}
    />
  );
}

export default function UsuariosPage(props: PageProps<"/admin/usuarios">) {
  return (
    <>
      <Cabecera />
      <main className="envoltura pagina-angosta">
        <nav className="migas">
          <Link href="/admin">← Panel del administrador</Link>
        </nav>
        <div className="titulo">
          <h1>Usuarios</h1>
          <p>Cambia entre jugador y dueño, o suspende una cuenta con motivo. Las cuentas de administrador no se tocan desde aquí.</p>
        </div>
        <section className="panel" aria-label="Cuentas">
          <Suspense fallback={<p className="meta">Cargando cuentas…</p>}>
            <Contenido {...props} />
          </Suspense>
        </section>
      </main>
    </>
  );
}
