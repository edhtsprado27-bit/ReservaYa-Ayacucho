// Puerto (interfaz) de los ajustes de la plataforma (por ahora, el WhatsApp de ayuda).

import type { AjustesPublicos } from "./soporte";

export interface AjustesRepositorio {
  /** Lo que cualquiera puede ver (sin sesión) */
  leerPublicos(): Promise<AjustesPublicos>;
  /** Solo el administrador */
  guardar(p: { whatsappSoporte: string | null }): Promise<AjustesPublicos>;
}
