// Tipos y textos de los roles. Sin dependencias del servidor:
// se puede importar desde componentes del navegador.

export type Rol = "jugador" | "dueno" | "admin";

export type Perfil = {
  id: string;
  rol: Rol;
  nombre: string;
  email: string | null;
  telefono: string | null;
};

export const ROL_TEXTO: Record<Rol, string> = {
  jugador: "Jugador",
  dueno: "Dueño de cancha",
  admin: "Administrador",
};

export const puedeRegistrarCanchas = (rol: Rol | undefined) => rol === "dueno" || rol === "admin";
