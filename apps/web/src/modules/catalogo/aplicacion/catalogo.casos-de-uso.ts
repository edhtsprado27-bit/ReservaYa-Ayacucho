// Casos de uso del catálogo. Capa: aplicación.
// Reciben el repositorio como parámetro (inversión de dependencias): no saben
// si detrás hay Supabase, una caché o datos en memoria para las pruebas.

import type { CatalogoRepositorio } from "../dominio/catalogo.repositorio";
import { validarId, validarNuevaCancha } from "../dominio/validar-nueva-cancha";

/** Canchas publicadas para el mapa (RF01, RF11) */
export const verCatalogo = (repo: CatalogoRepositorio) => repo.leerPublicadas();

/** Registrar una cancha: valida los datos y la deja en revisión (RF03) */
export function registrarCancha(repo: CatalogoRepositorio, datos: unknown) {
  return repo.proponer(validarNuevaCancha(datos));
}

/** Corregir una cancha que sigue en revisión */
export function corregirCancha(repo: CatalogoRepositorio, id: string, datos: unknown) {
  return repo.reemplazar(validarId(id), validarNuevaCancha(datos));
}

/** Quitar una cancha que sigue en revisión */
export function quitarCancha(repo: CatalogoRepositorio, id: string) {
  return repo.retirar(validarId(id));
}

/** Canchas en revisión que la persona puede ver */
export const verPendientes = (repo: CatalogoRepositorio) => repo.listarPendientes();

/** Canchas aprobadas del dueño */
export const verMisPublicadas = (repo: CatalogoRepositorio, duenoId: string) => repo.listarPublicadasDe(duenoId);

/** Aprobar o rechazar una cancha (RF08, solo admin; lo verifica la base) */
export function revisarCancha(repo: CatalogoRepositorio, id: string, aprobar: boolean, motivo?: string) {
  return repo.revisar(validarId(id), aprobar, motivo);
}
