// Casos de uso del WhatsApp de ayuda (RF15). Capa: aplicación.

import type { AjustesRepositorio } from "../dominio/ajustes.repositorio";
import { validarAjustes } from "../dominio/soporte";

export const verAjustesPublicos = (repo: AjustesRepositorio) => repo.leerPublicos();

/** El admin cambia (o quita, si viene vacío) el WhatsApp de ayuda */
export const guardarAjustesPlataforma = (repo: AjustesRepositorio, datos: unknown) => repo.guardar(validarAjustes(datos));
