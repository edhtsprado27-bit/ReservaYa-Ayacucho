// Barra superior: marca y, a la derecha, "Ingresar" o tu cuenta.
// La parte de la cuenta depende de la sesión: se carga aparte (Suspense)
// para que el resto de la página salga al instante.

import Link from "next/link";
import { Suspense } from "react";
import { obtenerCuenta, ROL_TEXTO } from "@/modules/cuentas/infraestructura/perfil";

async function Cuenta() {
  const { perfil, suspension } = await obtenerCuenta();
  if (suspension) {
    return (
      <Link href="/cuenta-suspendida" className="cuenta-ingresar cuenta-suspendida">
        Cuenta suspendida
      </Link>
    );
  }
  if (!perfil) {
    return (
      <Link href="/login" className="cuenta-ingresar">
        Ingresar
      </Link>
    );
  }
  const primerNombre = perfil.nombre.split(" ")[0];
  return (
    <Link href="/mi-cuenta" className="cuenta" aria-label={`Mi cuenta: ${perfil.nombre}, ${ROL_TEXTO[perfil.rol]}`}>
      <span className="cuenta-avatar" aria-hidden="true">{primerNombre.charAt(0).toUpperCase()}</span>
      <span className="cuenta-texto">
        <strong>{primerNombre}</strong>
        <small>{ROL_TEXTO[perfil.rol]}</small>
      </span>
    </Link>
  );
}

export default function Cabecera() {
  return (
    <header className="cabecera">
      <div className="envoltura cabecera-fila">
        <Link href="/" className="marca">
          ReservaYa <small>AYACUCHO</small>
        </Link>
        <Suspense fallback={<span className="cuenta-espera" aria-hidden="true" />}>
          <Cuenta />
        </Suspense>
      </div>
    </header>
  );
}
