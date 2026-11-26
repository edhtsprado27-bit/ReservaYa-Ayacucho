// Preguntas frecuentes de ReservaYa: respuestas de las reglas y la
// información que se le da a la IA para que no invente (RF09).
// Capa: dominio. Si cambia una regla del sistema, se cambia aquí.

export type TemaFrecuente = {
  tema: string;
  /** Cómo la escribiría alguien (se ofrece como sugerencia) */
  pregunta: string;
  /** Palabras que delatan el tema (texto sin tildes, en minúsculas) */
  claves: RegExp[];
  respuesta: string;
};

export const PREGUNTAS_FRECUENTES: TemaFrecuente[] = [
  {
    tema: "reservar",
    pregunta: "¿Cómo reservo una cancha?",
    claves: [/\bcomo reserv/, /\bhacer una reserva/, /\bpasos para reservar/, /\bcomo separo/, /\bcomo aparto/],
    respuesta:
      "Elige un local en el mapa (o pídemelo aquí), escoge el día y la hora en la grilla y pulsa «Reservar». Necesitas una cuenta, que es gratis. La hora queda apartada para ti mientras pagas el adelanto.",
  },
  {
    tema: "pagar",
    pregunta: "¿Cómo pago el adelanto?",
    claves: [/\bpag(o|ar|ue|as|a|os)\b/, /\badelanto/, /\byape\b/, /\bplin\b/, /\bcomprobante/, /\bcaptura/, /\btransfer/, /\befectivo/],
    respuesta:
      "Cada local pide un adelanto (normalmente el 50 % del total) que pagas por Yape o Plin al número que aparece en tu reserva. Después subes la captura del comprobante: la IA la lee y el dueño confirma tu reserva. El resto lo pagas en el local.",
  },
  {
    tema: "apartado",
    pregunta: "¿Cuánto tiempo tengo para pagar?",
    claves: [/\bapartad/, /\bminutos\b/, /\bse libera/, /\btiempo (para|de) pag/, /\bvence/, /\ba tiempo\b/, /\bno alcanzo/, /\bcuanto tiempo/],
    respuesta:
      "Al reservar, la hora queda apartada para ti un tiempo (15 minutos, salvo que el local diga otra cosa). Si no subes el comprobante en ese tiempo, la hora se libera sola para que otra persona la pueda reservar.",
  },
  {
    tema: "cancelar",
    pregunta: "¿Puedo cancelar mi reserva?",
    claves: [/\bcancel/, /\bdevoluc/, /\bdevuelv/, /\breembols/, /\bno (voy a )?poder ir/, /\bno puedo ir/, /\banular/],
    respuesta:
      "Sí: en «Mis reservas» puedes cancelar mientras el partido no haya empezado. Si cancelas con la anticipación que pide el local (6 horas, salvo que el local diga otra cosa), te corresponde la devolución del adelanto; coordínala con el local por WhatsApp.",
  },
  {
    tema: "confirmacion",
    pregunta: "¿Cómo sé si mi reserva está confirmada?",
    claves: [/\bconfirm/, /\bestado de mi reserva/, /\baprobad/, /\bverific/],
    respuesta:
      "Tu reserva se confirma cuando el dueño revisa tu comprobante. Mira el estado en «Mis reservas»: dice «Por pagar», «Pago en revisión» o «Confirmada».",
  },
  {
    tema: "limites",
    pregunta: "¿Con cuántos días de anticipación puedo reservar?",
    claves: [/\bcuantas reservas/, /\banticipacion/, /\bcuantos dias/, /\bcon cuanto tiempo/, /\bhasta cuando/, /\bpor adelantado/, /\bsemana que viene/],
    respuesta:
      "Puedes reservar desde hoy hasta 14 días después, de 6 de la mañana a 11 de la noche. Puedes tener hasta 2 reservas por pagar a la vez.",
  },
  {
    tema: "precios",
    pregunta: "¿Cuánto cuesta una cancha?",
    claves: [/\bprecio/, /\bcuanto cuesta/, /\bcuanto cobran/, /\bcuanto sale/, /\bhora punta/, /\btarifa/, /\bcosto/],
    respuesta:
      "Cada local pone su precio por hora, y en la hora punta (normalmente en la noche) puede costar más. El total exacto lo ves en la grilla antes de reservar. Si me dices el distrito o el local, te muestro sus precios.",
  },
  {
    tema: "llegar",
    pregunta: "¿Cómo llego al local?",
    claves: [/\bcomo lleg/, /\bdireccion/, /\bubicacion/, /\bdonde queda/, /\bgoogle maps/, /\bwaze/],
    respuesta: "En la ficha de cada local tienes los botones «Google Maps» y «Waze» que te llevan hasta la puerta, además de la dirección y una referencia.",
  },
  {
    tema: "contacto",
    pregunta: "¿Cómo hablo con el local?",
    claves: [/\bwhatsapp/, /\bcontact/, /\btelefono/, /\bcelular/, /\bllamar/, /\bescribir al/, /\bsoporte/, /\bhablar con/],
    respuesta:
      "En la ficha del local y en tu reserva tienes el botón «Escribir por WhatsApp», con el mensaje ya escrito. Para problemas con la web, usa el botón verde «Ayuda».",
  },
  {
    tema: "cuenta",
    pregunta: "¿Cómo creo mi cuenta?",
    claves: [/\bcontrasena/, /\bclave\b/, /\bregistrarme/, /\bcrear (una |mi )?cuenta/, /\biniciar sesion/, /\bingresar\b/, /\bolvide/],
    respuesta:
      "Toca «Ingresar» arriba a la derecha y crea tu cuenta con tu correo; es gratis. Si olvidaste tu contraseña, en esa misma pantalla usa «¿Olvidaste tu contraseña?».",
  },
  {
    tema: "dueno",
    pregunta: "Tengo una cancha, ¿cómo la publico?",
    claves: [/\bsoy (el )?duen/, /\btengo (una|mi) cancha/, /\bpublicar/, /\bregistrar (mi|una) cancha/, /\bagregar (mi |una )?cancha/, /\bmi local\b/],
    respuesta:
      "Crea tu cuenta como dueño y usa «+ Agregar cancha» en el mapa para marcar tu local. El administrador lo revisa antes de publicarlo. Después configuras horarios, precios, servicios y tu Yape o Plin desde tu panel.",
  },
  {
    tema: "asistente",
    pregunta: "¿Qué puedes hacer?",
    claves: [/\bque puedes hacer/, /\bquien eres/, /\bcomo funcionas/, /\bcomo te uso/, /\bayudame\b/, /\bque eres/],
    respuesta:
      "Te ayudo a encontrar una cancha libre: dime el deporte, el distrito, el día y la hora (por ejemplo «fútbol en Carmen Alto mañana a las 7») y te muestro los locales con esa hora libre. También respondo dudas sobre reservas y pagos.",
  },
];

/** Temas con más coincidencias (puede haber empate) y cuántas tuvieron. Texto sin tildes y en minúsculas. */
export function buscarTema(texto: string): { temas: TemaFrecuente[]; puntos: number } | null {
  const conPuntos = PREGUNTAS_FRECUENTES.map((tema) => ({ tema, puntos: tema.claves.filter((re) => re.test(texto)).length }));
  const puntos = Math.max(...conPuntos.map((c) => c.puntos));
  if (puntos === 0) return null;
  return { temas: conPuntos.filter((c) => c.puntos === puntos).map((c) => c.tema), puntos };
}

/** Lo mismo, en texto corrido, para las instrucciones de la IA */
export const conocimientoParaIA = () => PREGUNTAS_FRECUENTES.map((t) => `- ${t.pregunta} ${t.respuesta}`).join("\n");
