"use client";

// Pagar el adelanto: a qué Yape/Plin pagar y subir la captura.
// La captura se achica en el celular antes de enviarla (sube más rápido y
// la IA la lee igual de bien).

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { celularTexto, METODO_TEXTO, type MetodoPago } from "@/modules/pagos/dominio/pago";
import { soles } from "@/modules/reservas/dominio/tiempo";

type Props = {
  reservaId: string;
  adelanto: number;
  yape: string | null;
  plin: string | null;
  titular: string | null;
  telefonoLocal: string | null;
  rechazo: string | null;
};

const LADO_MAXIMO = 1600; // px
const MAX_BYTES = 3 * 1024 * 1024;

// Reduce la imagen a JPG de 1600 px como máximo. Si el navegador no puede, se envía tal cual.
async function achicar(archivo: File): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(archivo);
    const escala = Math.min(1, LADO_MAXIMO / Math.max(bmp.width, bmp.height));
    const lienzo = document.createElement("canvas");
    lienzo.width = Math.round(bmp.width * escala);
    lienzo.height = Math.round(bmp.height * escala);
    const ctx = lienzo.getContext("2d");
    if (!ctx) return archivo;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, lienzo.width, lienzo.height);
    ctx.drawImage(bmp, 0, 0, lienzo.width, lienzo.height);
    bmp.close();
    const blob = await new Promise<Blob | null>((ok) => lienzo.toBlob(ok, "image/jpeg", 0.85));
    return blob && blob.size < archivo.size ? blob : archivo;
  } catch {
    return archivo;
  }
}

function CuentaDestino({ metodo, numero }: { metodo: MetodoPago; numero: string }) {
  const [copiado, setCopiado] = useState(false);
  async function copiar() {
    try {
      await navigator.clipboard.writeText(numero);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // Sin permiso para copiar: el número igual está a la vista
    }
  }
  return (
    <div className="cuenta-pago">
      <span className={`marca-pago marca-pago--${metodo}`}>{METODO_TEXTO[metodo]}</span>
      <strong>{celularTexto(numero)}</strong>
      <button type="button" className="enlace-boton" onClick={copiar}>
        {copiado ? "Copiado ✓" : "Copiar"}
      </button>
    </div>
  );
}

export default function PagoAdelanto({ reservaId, adelanto, yape, plin, titular, telefonoLocal, rechazo }: Props) {
  const router = useRouter();
  const [metodo, setMetodo] = useState<MetodoPago>(yape || !plin ? "yape" : "plin");
  const [archivo, setArchivo] = useState<File | null>(null);
  const [vista, setVista] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Libera la vista previa al cambiar de foto o salir de la página
  useEffect(() => {
    return () => {
      if (vista) URL.revokeObjectURL(vista);
    };
  }, [vista]);

  function elegirArchivo(f: File | undefined) {
    setError(null);
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      setError("Elige una imagen (la captura de pantalla del pago).");
      return;
    }
    setArchivo(f);
    setVista(URL.createObjectURL(f));
  }

  async function enviar() {
    if (!archivo || enviando) return;
    setEnviando(true);
    setError(null);
    const imagen = await achicar(archivo);
    if (imagen.size > MAX_BYTES) {
      setEnviando(false);
      setError("La imagen pesa más de 3 MB. Toma la captura otra vez.");
      return;
    }
    const datos = new FormData();
    datos.append("metodo", metodo);
    datos.append("imagen", imagen, imagen === archivo ? archivo.name : "comprobante.jpg");
    const res = await fetch(`/api/reservas/${reservaId}/pago`, { method: "POST", body: datos }).catch(() => null);
    const json = await res?.json().catch(() => null);
    if (res?.ok && json?.ok) {
      router.refresh();
      return; // el botón queda en "Leyendo…" hasta que la página cambie
    }
    setEnviando(false);
    setError(json?.error ?? "Sin conexión. Revisa tu internet y vuelve a intentar.");
    if (json?.codigo === "RESERVA_VENCIDA" || json?.codigo === "PAGO_YA_ENVIADO") router.refresh();
  }

  const sinCuentas = !yape && !plin;

  return (
    <div className="pago-pasos">
      {rechazo && (
        <p className="aviso aviso--error" role="alert">
          El local no aceptó tu comprobante anterior: “{rechazo}”. Revisa el pago y envía otra captura.
        </p>
      )}

      <div className="paso-pago">
        <span className="paso-numero" aria-hidden="true">1</span>
        <div>
          <strong>Paga {soles(adelanto)} desde tu app</strong>
          {sinCuentas ? (
            <p className="meta">
              Este local todavía no registró su Yape o Plin.
              {telefonoLocal
                ? ` Escríbele por WhatsApp (botón “Escribir al local”, abajo) o llama al ${telefonoLocal} para que te lo den.`
                : " Llama al local para que te lo den."}
            </p>
          ) : (
            <>
              {yape && <CuentaDestino metodo="yape" numero={yape} />}
              {plin && <CuentaDestino metodo="plin" numero={plin} />}
              {titular && <p className="meta">A nombre de: {titular}</p>}
            </>
          )}
        </div>
      </div>

      <div className="paso-pago">
        <span className="paso-numero" aria-hidden="true">2</span>
        <div>
          <strong>Sube la captura del pago</strong>
          <div className="chips" role="radiogroup" aria-label="¿Con qué pagaste?">
            {(["yape", "plin"] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                className="chip"
                aria-checked={metodo === m}
                onClick={() => setMetodo(m)}
              >
                {METODO_TEXTO[m]}
              </button>
            ))}
          </div>
          <label className="subir-archivo">
            <input type="file" accept="image/*" onChange={(e) => elegirArchivo(e.target.files?.[0])} disabled={enviando} />
            <span>{archivo ? "Cambiar captura" : "Elegir captura"}</span>
          </label>
          {vista && (
            // eslint-disable-next-line @next/next/no-img-element -- vista previa local (blob:), no pasa por next/image
            <img src={vista} alt="Vista previa de tu captura" className="vista-previa" />
          )}
          {error && (
            <p className="aviso aviso--error" role="alert">
              {error}
            </p>
          )}
          <button type="button" className="boton boton--naranja" onClick={enviar} disabled={!archivo || enviando}>
            {enviando ? "Leyendo tu comprobante…" : "Enviar comprobante"}
          </button>
        </div>
      </div>

      <p className="meta letra-chica">
        Tu captura solo la ven tú y el dueño del local. Una inteligencia artificial lee el monto y el número de
        operación para que el local confirme más rápido; quien confirma es el local, revisando su cuenta.
      </p>
    </div>
  );
}
