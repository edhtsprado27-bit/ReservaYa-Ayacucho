import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import Cabecera from "@/components/Cabecera";
import FormNuevaClave from "@/components/cuenta/FormNuevaClave";
import { obtenerPerfil } from "@/lib/auth/perfil";

export const metadata: Metadata = { title: "Nueva contraseña · ReservaYa Ayacucho" };

// Se llega aquí desde el enlace del correo, que ya inició la sesión
async function Formulario() {
  if (!(await obtenerPerfil())) redirect("/login?modo=recuperar");
  return <FormNuevaClave />;
}

export default function NuevaClavePage() {
  return (
    <>
      <Cabecera />
      <main className="envoltura pagina-angosta">
        <div className="titulo">
          <h1>Crea tu nueva contraseña</h1>
          <p>Usa al menos 8 caracteres.</p>
        </div>
        <Suspense fallback={<p className="meta">Cargando…</p>}>
          <Formulario />
        </Suspense>
      </main>
    </>
  );
}
