import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import LoginEstadio, { type ModoLogin } from "@/components/login/LoginEstadio";
import { destinoSeguro } from "@/lib/auth/destino";
import { obtenerPerfil } from "@/lib/auth/perfil";

export const metadata: Metadata = { title: "Ingresar · ReservaYa Ayacucho" };

const AVISOS: Record<string, string> = {
  enlace: "Ese enlace no es válido o ya venció. Pide uno nuevo.",
};

async function Login({ searchParams }: { searchParams: PageProps<"/login">["searchParams"] }) {
  const sp = await searchParams;
  const texto = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);
  const next = destinoSeguro(texto(sp.next));

  // Si ya inició sesión, no tiene sentido mostrar el login
  if (await obtenerPerfil()) redirect(next);

  const modo: ModoLogin = sp.modo === "registro" ? "registro" : sp.modo === "recuperar" ? "recuperar" : "ingresar";
  return <LoginEstadio next={next} modoInicial={modo} aviso={AVISOS[texto(sp.error) ?? ""]} />;
}

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <Suspense fallback={<div style={{ position: "fixed", inset: 0, background: "#070b14" }} />}>
      <Login searchParams={searchParams} />
    </Suspense>
  );
}
