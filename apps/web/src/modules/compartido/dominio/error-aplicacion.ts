// Error de la aplicación con un código estable, el estado HTTP y un mensaje
// claro para la pantalla. Lo usan todos los módulos (catálogo, reservas, pagos).
// Capa: dominio (no depende de Next.js, Supabase ni de ninguna librería).

export class ErrorAplicacion extends Error {
  constructor(
    public codigo: string,
    public status: number,
    mensaje: string,
  ) {
    super(mensaje);
  }
}

// Códigos de error -> mensaje para la persona y estado HTTP
export const MENSAJES: Record<string, { mensaje: string; status: number }> = {
  FALTA_CONFIGURAR_SUPABASE: {
    mensaje: "Falta configurar Supabase: revisa el archivo apps/web/.env.local y reinicia npm run dev.",
    status: 500,
  },
  SIN_CONEXION: {
    mensaje: "No se pudo conectar con Supabase. Revisa la URL en .env.local y tu conexión a internet.",
    status: 502,
  },
  CLAVE_INVALIDA: {
    mensaje: "Supabase rechazó la clave. Copia de nuevo la clave publishable (o anon) en .env.local.",
    status: 502,
  },
  FALTA_MIGRACION: {
    mensaje:
      "Supabase no tiene las funciones nuevas. Ejecuta las migraciones 004 a 010 en el SQL Editor.",
    status: 502,
  },
  SIN_SESION: { mensaje: "Inicia sesión para continuar.", status: 401 },
  SOLO_DUENOS: {
    mensaje: "Solo las cuentas de dueño o administrador pueden registrar canchas.",
    status: 403,
  },
  SOLO_ADMIN: { mensaje: "Solo el administrador puede aprobar o rechazar canchas.", status: 403 },
  DATOS_INVALIDOS: { mensaje: "Faltan datos de la cancha (nombre, distrito y ubicación).", status: 400 },
  NOMBRE_INVALIDO: { mensaje: "El nombre debe tener entre 3 y 120 caracteres.", status: 400 },
  FUERA_DE_HUAMANGA: { mensaje: "La ubicación está fuera de la provincia de Huamanga.", status: 400 },
  DISTRITO_NO_ENCONTRADO: { mensaje: "No reconocemos ese distrito.", status: 400 },
  DISTRITO_NO_ACTIVO: { mensaje: "Ese distrito todavía no está habilitado.", status: 400 },
  DISTRICT_NOT_ACTIVE: { mensaje: "Ese distrito todavía no está habilitado.", status: 400 },
  PRECIO_INVALIDO: { mensaje: "El precio por hora debe estar entre S/ 1 y S/ 1000.", status: 400 },
  LOCAL_DUPLICADO: { mensaje: "Ya existe una cancha con ese nombre en el distrito o en ese mismo punto.", status: 409 },
  PROPUESTA_NO_ENCONTRADA: {
    mensaje: "Esa cancha ya fue revisada o ya no existe. Recarga la página.",
    status: 404,
  },
  DEMASIADAS_PROPUESTAS: {
    mensaje: "Se registraron demasiadas canchas en la última hora. Intenta más tarde.",
    status: 429,
  },
  // Reservas
  CANCHA_NO_DISPONIBLE: { mensaje: "Esta cancha no está recibiendo reservas ahora.", status: 409 },
  HORARIO_OCUPADO: {
    mensaje: "Alguien acaba de reservar ese horario. Elige otra hora: la grilla ya está actualizada.",
    status: 409,
  },
  HORARIO_PASADO: { mensaje: "Esa hora ya pasó. Elige una hora que todavía no haya empezado.", status: 400 },
  HORARIO_INVALIDO: { mensaje: "Elige horas seguidas dentro del horario de atención de la cancha.", status: 400 },
  HORARIO_CERRADO: { mensaje: "La cancha está cerrada en ese horario (mantenimiento o evento).", status: 409 },
  DURACION_INVALIDA: { mensaje: "Esa cantidad de horas no está permitida en esta cancha.", status: 400 },
  FECHA_MUY_LEJANA: { mensaje: "Solo se puede reservar hasta 30 días antes.", status: 400 },
  SIN_TARIFA: {
    mensaje: "Esta cancha todavía no publicó su precio. Llama al local para reservar.",
    status: 409,
  },
  DEMASIADAS_PENDIENTES: {
    mensaje: "Ya tienes 2 reservas por pagar. Paga o cancela una antes de apartar otra hora.",
    status: 429,
  },
  RESERVA_NO_ENCONTRADA: { mensaje: "No encontramos esa reserva en tu cuenta.", status: 404 },
  RESERVA_VENCIDA: {
    mensaje: "Esta reserva ya venció y el horario se liberó. Si ya pagaste, llama al local.",
    status: 409,
  },
  NO_SE_PUEDE_CANCELAR: { mensaje: "Esta reserva ya no se puede cancelar.", status: 409 },
  // Pagos
  LOCAL_AJENO: {
    mensaje: "Solo el dueño de este local o el administrador pueden hacer esto.",
    status: 403,
  },
  CELULAR_INVALIDO: { mensaje: "El celular de Yape o Plin debe tener 9 dígitos y empezar con 9.", status: 400 },
  FALTA_TITULAR: { mensaje: "Escribe el nombre del titular tal como aparece en Yape o Plin.", status: 400 },
  COMPROBANTE_NO_ENCONTRADO: { mensaje: "No encontramos la captura. Vuelve a subirla.", status: 400 },
  PAGO_YA_ENVIADO: {
    mensaje: "Ya enviaste un comprobante para esta reserva. Espera a que el local lo revise.",
    status: 409,
  },
  PAGO_NO_ENCONTRADO: { mensaje: "No encontramos ese pago entre los de tus canchas.", status: 404 },
  PAGO_YA_REVISADO: { mensaje: "Este pago ya fue revisado. Recarga la página.", status: 409 },
  FALTA_MOTIVO: { mensaje: "Escribe el motivo (mínimo 3 letras): el jugador lo va a ver.", status: 400 },
  // Agenda del dueño (paso 7)
  FECHA_FUERA_DE_RANGO: { mensaje: "La agenda muestra desde 90 días atrás hasta 60 días adelante.", status: 400 },
  NOMBRE_CLIENTE_INVALIDO: { mensaje: "Escribe el nombre de quien reserva (2 a 120 letras).", status: 400 },
  MONTO_INVALIDO: { mensaje: "El monto no puede ser mayor que lo que falta pagar.", status: 400 },
  ACCION_INVALIDA: { mensaje: "Esa acción no existe.", status: 400 },
  ACCION_NO_PERMITIDA: {
    mensaje: "Esa acción no se puede hacer con esta reserva ahora (revisa la hora y su estado).",
    status: 409,
  },
  HAY_RESERVAS: {
    mensaje: "Hay reservas en esas horas. Cancélalas primero para que los jugadores reciban el aviso.",
    status: 409,
  },
  YA_BLOQUEADO: { mensaje: "Parte de esas horas ya está bloqueada.", status: 409 },
  BLOQUEO_NO_ENCONTRADO: { mensaje: "Ese bloqueo ya no existe. Recarga la página.", status: 404 },
  DESCONOCIDO: { mensaje: "Ocurrió un error con la base de datos. Inténtalo de nuevo.", status: 500 },
};

/** Crea el error de un código conocido (o DESCONOCIDO si no existe). */
export function crearError(codigo: string, detalle?: string): ErrorAplicacion {
  const m = MENSAJES[codigo] ?? MENSAJES.DESCONOCIDO;
  if (codigo === "DESCONOCIDO" && detalle) console.error("[error] Base de datos:", detalle);
  return new ErrorAplicacion(codigo in MENSAJES ? codigo : "DESCONOCIDO", m.status, m.mensaje);
}
