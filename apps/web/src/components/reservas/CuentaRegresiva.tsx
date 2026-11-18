"use client";

// "Tienes 14:32 para pagar". Cuando llega a cero, vuelve a pedir la página
// para mostrar que el apartado venció y el horario se liberó.

import { useRouter } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";

const suscribir = (aviso: () => void) => {
  const t = setInterval(aviso, 1000);
  return () => clearInterval(t);
};
const segundoActual = () => Math.floor(Date.now() / 1000);
const sinReloj = () => null; // en el servidor no se muestra la cuenta

export default function CuentaRegresiva({ vence }: { vence: string }) {
  const router = useRouter();
  const ahora = useSyncExternalStore(suscribir, segundoActual, sinReloj);
  const restante = ahora === null ? null : Math.max(0, Math.floor(new Date(vence).getTime() / 1000) - ahora);
  const vencido = restante === 0;

  useEffect(() => {
    if (vencido) router.refresh();
  }, [vencido, router]);

  if (restante === null) return <p className="cuenta-regresiva">Calculando tiempo…</p>;
  if (vencido) return <p className="cuenta-regresiva cuenta-regresiva--fin">El tiempo terminó.</p>;

  const mm = String(Math.floor(restante / 60)).padStart(2, "0");
  const ss = String(restante % 60).padStart(2, "0");
  return (
    <p className={`cuenta-regresiva${restante < 120 ? " cuenta-regresiva--poco" : ""}`} role="timer" aria-live="off">
      Tienes <strong>{mm}:{ss}</strong> para pagar el adelanto
    </p>
  );
}
