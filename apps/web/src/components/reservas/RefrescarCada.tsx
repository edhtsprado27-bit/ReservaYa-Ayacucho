"use client";

// Vuelve a pedir la página cada cierto tiempo (por ejemplo, mientras el local
// revisa el pago), solo si la pestaña está a la vista.

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function RefrescarCada({ segundos }: { segundos: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, segundos * 1000);
    return () => clearInterval(t);
  }, [router, segundos]);
  return null;
}
