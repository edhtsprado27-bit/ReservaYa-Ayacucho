"use client";

// Login 3D de ReservaYa conectado a Supabase Auth.
// Modos: ingresar · crear cuenta (jugador o dueño) · recuperar contraseña.

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { clienteNavegador } from "@/modules/compartido/infraestructura/supabase/cliente-navegador";
import type { Estadio } from "./estadio3d";
import s from "./login.module.css";

export type ModoLogin = "ingresar" | "registro" | "recuperar";
type TipoCuenta = "jugador" | "dueno";

const LEAD: Record<ModoLogin, string> = {
  ingresar: "Inicia sesión para reservar tu cancha.",
  registro: "Crea tu cuenta gratis en un minuto.",
  recuperar: "Te enviaremos un enlace para crear una nueva contraseña.",
};

const BOTON: Record<ModoLogin, string> = {
  ingresar: "INICIAR SESIÓN",
  registro: "CREAR CUENTA",
  recuperar: "ENVIAR ENLACE",
};

// Mensajes de Supabase Auth en español
function traducirError(e: { code?: string; message?: string; status?: number } | null): string {
  const code = e?.code ?? "";
  const m = (e?.message ?? "").toLowerCase();
  if (code === "invalid_credentials" || m.includes("invalid login")) return "Correo o contraseña incorrectos.";
  if (code === "email_not_confirmed" || m.includes("not confirmed"))
    return "Primero confirma tu correo: abre el enlace que te enviamos.";
  if (code === "user_already_exists" || code === "email_exists" || m.includes("already registered"))
    return "Ese correo ya tiene una cuenta. Inicia sesión.";
  if (code === "weak_password" || m.includes("password should"))
    return "La contraseña es muy débil: usa al menos 8 caracteres, con letras y números.";
  if (code === "email_address_invalid" || m.includes("invalid email") || m.includes("is invalid"))
    return "Ese correo no es válido.";
  if (code === "over_email_send_rate_limit" || m.includes("email rate limit"))
    return "Se enviaron demasiados correos. Espera unos minutos e inténtalo de nuevo.";
  if (code === "over_request_rate_limit" || e?.status === 429) return "Demasiados intentos. Espera un momento.";
  if (code === "signup_disabled") return "El registro está desactivado en Supabase.";
  if (m.includes("fetch") || m.includes("network")) return "Sin conexión con Supabase. Revisa tu internet.";
  return "No se pudo completar. Inténtalo de nuevo.";
}

const correoValido = (c: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(c);

export default function LoginEstadio({
  next,
  modoInicial,
  aviso,
}: {
  next: string;
  modoInicial: ModoLogin;
  aviso?: string;
}) {
  const [modo, setModo] = useState<ModoLogin>(modoInicial);
  const [msg, setMsg] = useState(aviso ?? "");
  const [enviando, setEnviando] = useState(false);
  const [verClave, setVerClave] = useState(false);
  const [f, setF] = useState({ nombre: "", email: "", telefono: "", clave: "", tipo: "jugador" as TipoCuenta });

  const bgRef = useRef<HTMLCanvasElement>(null);
  const fgRef = useRef<HTMLCanvasElement>(null);
  const cardRef = useRef<HTMLFormElement>(null);
  const golRef = useRef<HTMLDivElement>(null);
  const estadio = useRef<Estadio | null>(null);

  // Estadio 3D: se carga aparte (three.js) para no frenar el formulario
  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        await document.fonts?.ready;
        const { crearEstadio } = await import("./estadio3d");
        if (cancelado || !bgRef.current || !fgRef.current || !cardRef.current || !golRef.current) return;
        estadio.current = crearEstadio({
          bg: bgRef.current,
          fg: fgRef.current,
          tarjeta: cardRef.current,
          gol: golRef.current,
          claseArrastre: s.arrastrando,
          claseGol: s.mostrar,
        });
      } catch {
        // Sin WebGL: queda el fondo oscuro y el formulario funciona igual
      }
    })();
    return () => {
      cancelado = true;
      estadio.current?.destruir();
      estadio.current = null;
    };
  }, []);

  // La tarjeta cambia de alto entre modos: el futbolista se reubica
  useEffect(() => {
    estadio.current?.recalcular();
  }, [modo]);

  const cambiarModo = (m: ModoLogin) => {
    setModo(m);
    setMsg("");
    setVerClave(false);
  };
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));

  // Carga completa de la página: así todo se vuelve a armar con la sesión nueva
  // (más seguro que navegar dentro de la app justo después de iniciar sesión).
  const entrar = () => {
    window.location.assign(next);
  };

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    const email = f.email.trim().toLowerCase();
    if (!correoValido(email)) return setMsg("Escribe un correo válido.");
    if (modo !== "recuperar" && !f.clave) return setMsg("Escribe tu contraseña.");
    if (modo === "registro") {
      if (f.nombre.trim().length < 3) return setMsg("Escribe tu nombre y apellido.");
      if (f.clave.length < 8) return setMsg("La contraseña debe tener al menos 8 caracteres.");
      const tel = f.telefono.replace(/\D/g, "");
      if (tel && !/^9\d{8}$/.test(tel)) return setMsg("El celular debe tener 9 dígitos y empezar con 9.");
    }

    let supabase;
    try {
      supabase = clienteNavegador();
    } catch {
      return setMsg("Falta configurar Supabase en apps/web/.env.local.");
    }

    setEnviando(true);
    setMsg(modo === "registro" ? "Creando tu cuenta…" : modo === "recuperar" ? "Enviando…" : "Ingresando…");
    try {
      if (modo === "ingresar") {
        const { error } = await supabase.auth.signInWithPassword({ email, password: f.clave });
        if (error) return setMsg(traducirError(error));
        // Si el administrador suspendió la cuenta, se muestra el motivo (RF08)
        const { data: perfil } = await supabase.rpc("fn_mi_perfil");
        if (Array.isArray(perfil) && perfil[0]?.estado === "suspended") {
          setMsg("Tu cuenta está suspendida.");
          // eslint-disable-next-line @next/next/no-location-assign-relative-destination
          return window.location.assign("/cuenta-suspendida");
        }
        setMsg("¡Listo! Entrando…");
        return entrar();
      }

      if (modo === "registro") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password: f.clave,
          options: {
            data: { nombre: f.nombre.trim(), telefono: f.telefono.replace(/\D/g, ""), rol: f.tipo },
            emailRedirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
          },
        });
        if (error) return setMsg(traducirError(error));
        // Supabase no avisa con error si el correo ya existe (para no revelar cuentas)
        if (data.user && data.user.identities?.length === 0) {
          setModo("ingresar");
          return setMsg("Ese correo ya tiene una cuenta. Inicia sesión.");
        }
        if (data.session) {
          setMsg("¡Cuenta creada! Entrando…");
          return entrar();
        }
        setModo("ingresar");
        return setMsg(`Te enviamos un correo a ${email}. Abre el enlace para activar tu cuenta.`);
      }

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${location.origin}/auth/callback?next=/nueva-clave`,
      });
      if (error) return setMsg(traducirError(error));
      setMsg("Si ese correo tiene una cuenta, te llegará un enlace en unos minutos. Revisa también la carpeta de spam.");
    } catch (err) {
      setMsg(traducirError(err as Error));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className={s.pagina}>
      <canvas ref={bgRef} className={s.bg} aria-label="Estadio 3D: arrastra para girar y toca la cancha para patear el balón" />

      <div className={`${s.stage} ${modo === "registro" ? s.stageRegistro : ""}`}>
        <form ref={cardRef} className={`${s.card} ${modo === "registro" ? s.cardAncha : ""}`} onSubmit={enviar} noValidate>
          <div className={s.brand}>
            <svg aria-hidden="true" viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polygon points="12,7.6 15.8,10.4 14.4,14.8 9.6,14.8 8.2,10.4" fill="currentColor" />
              <path d="M12 7.6V2M15.8 10.4L21.2 8.7M14.4 14.8L17.6 19.4M9.6 14.8L6.4 19.4M8.2 10.4L2.8 8.7" />
            </svg>
            <b>ReservaYa</b>
            <small>AYACUCHO</small>
          </div>
          <div>
            <h1>¡Bienvenido!</h1>
            <p className={s.lead}>{LEAD[modo]}</p>
          </div>

          {modo === "registro" && (
            <div className={s.par}>
            <div className={s.field}>
              <label htmlFor="nombre">Nombre y apellido *</label>
              <div className={s.control}>
                <svg className={s.ico} aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#333" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" /></svg>
                <input id="nombre" name="nombre" autoComplete="name" placeholder="Ej. Carlos Huamán" value={f.nombre} onChange={(e) => set("nombre", e.target.value)} required />
              </div>
            </div>
            <div className={s.field}>
              <label htmlFor="telefono">Celular <span className={s.ayuda}>(opcional)</span></label>
              <div className={s.control}>
                <svg className={s.ico} aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#333" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="6" y="2" width="12" height="20" rx="2.5" /><path d="M11 18h2" /></svg>
                <input id="telefono" name="telefono" type="tel" inputMode="numeric" autoComplete="tel-national" placeholder="9XX XXX XXX" value={f.telefono} onChange={(e) => set("telefono", e.target.value)} />
              </div>
            </div>
            </div>
          )}

          <div className={modo === "registro" ? s.par : s.campos}>
          <div className={s.field}>
            <label htmlFor="email">Correo electrónico *</label>
            <div className={s.control}>
              <svg className={s.ico} aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#333" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></svg>
              <input id="email" name="email" type="email" inputMode="email" autoComplete={modo === "registro" ? "email" : "username"} placeholder="tu@correo.com" value={f.email} onChange={(e) => set("email", e.target.value)} required />
            </div>
          </div>


          {modo !== "recuperar" && (
            <div className={s.field}>
              <label htmlFor="password">Contraseña *{modo === "registro" && <span className={s.ayuda}> (mín. 8)</span>}</label>
              <div className={s.control}>
                <svg className={s.ico} aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#333" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
                <input id="password" name="password" type={verClave ? "text" : "password"} autoComplete={modo === "registro" ? "new-password" : "current-password"} placeholder={modo === "registro" ? "Crea una contraseña" : "Ingresa tu contraseña"} value={f.clave} onChange={(e) => set("clave", e.target.value)} required />
                <button className={s.peek} type="button" onClick={() => setVerClave((v) => !v)} aria-label={verClave ? "Ocultar contraseña" : "Mostrar contraseña"}>
                  <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></svg>
                </button>
              </div>
            </div>
          )}
          </div>

          {modo === "registro" && (
            <fieldset className={s.tipo}>
              <legend className={s.tipoTitulo}>¿Qué quieres hacer?</legend>
              <label className={s.opcion}>
                <input type="radio" name="tipo" value="jugador" checked={f.tipo === "jugador"} onChange={() => set("tipo", "jugador")} />
                Reservar canchas
                <small>Cuenta de jugador</small>
              </label>
              <label className={s.opcion}>
                <input type="radio" name="tipo" value="dueno" checked={f.tipo === "dueno"} onChange={() => set("tipo", "dueno")} />
                Tengo una cancha
                <small>Cuenta de dueño</small>
              </label>
            </fieldset>
          )}

          <button className={s.btn} type="submit" disabled={enviando}>
            {enviando ? "…" : BOTON[modo]}
          </button>

          <div className={s.row}>
            {modo === "ingresar" && (
              <>
                <button type="button" className={s.enlace} onClick={() => cambiarModo("recuperar")}>¿Olvidaste tu contraseña?</button>
                <span>¿Nuevo? <button type="button" className={s.enlace} onClick={() => cambiarModo("registro")}>Regístrate</button></span>
              </>
            )}
            {modo === "registro" && (
              <span>¿Ya tienes cuenta? <button type="button" className={s.enlace} onClick={() => cambiarModo("ingresar")}>Inicia sesión</button></span>
            )}
            {modo === "recuperar" && (
              <button type="button" className={s.enlace} onClick={() => cambiarModo("ingresar")}>Volver a iniciar sesión</button>
            )}
          </div>
          <p className={s.msg} role="status" aria-live="polite">{msg}</p>
        </form>
      </div>

      <canvas ref={fgRef} className={s.fg} aria-hidden="true" />

      <Link href="/" className={`${s.pastilla} ${s.volver}`}>
        <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
        Volver al mapa
      </Link>
      <button className={`${s.pastilla} ${s.replay}`} type="button" onClick={() => estadio.current?.reiniciar()}>
        <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v5h5" /></svg>
        Repetir animación
      </button>

      <div ref={golRef} className={s.goal} aria-live="polite" />

      <footer className={s.foot}>
        <strong>RESERVA TU CANCHA DEPORTIVA</strong>
        <span>Toca la cancha para patear el balón · Arrastra para girar el estadio</span>
      </footer>
    </div>
  );
}
