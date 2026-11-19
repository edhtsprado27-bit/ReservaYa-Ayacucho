// Caché del catálogo (patrón Decorator): envuelve otro repositorio y guarda
// en memoria las canchas publicadas durante 30 s.
//  - Varias visitas seguidas comparten una sola consulta a la base de datos.
//  - La ruta /api/canchas además pide al CDN de Vercel que guarde la respuesta 60 s.
//  - Al aprobar una cancha, la caché se borra para que aparezca al instante.
// Se puede quitar o cambiar (por ejemplo, por Redis) sin tocar los casos de uso.

import type { NuevaCancha } from "../dominio/cancha";
import type { Catalogo, CatalogoRepositorio } from "../dominio/catalogo.repositorio";

export const TTL_CATALOGO_MS = 30_000;

export class CatalogoEnCache implements CatalogoRepositorio {
  private cache: (Catalogo & { expira: number }) | null = null;
  private enCurso: Promise<Catalogo> | null = null;

  constructor(
    private readonly origen: CatalogoRepositorio,
    private readonly ttlMs = TTL_CATALOGO_MS,
    private readonly ahora: () => number = Date.now,
  ) {}

  async leerPublicadas(): Promise<Catalogo> {
    if (this.cache && this.cache.expira > this.ahora()) return this.cache;
    if (this.enCurso) return this.enCurso;

    this.enCurso = (async () => {
      const catalogo = await this.origen.leerPublicadas();
      this.cache = { ...catalogo, expira: this.ahora() + this.ttlMs };
      return catalogo;
    })();

    try {
      return await this.enCurso;
    } finally {
      this.enCurso = null;
    }
  }

  /** Borra la copia guardada (la siguiente lectura va a la base de datos) */
  invalidar() {
    this.cache = null;
  }

  // El resto de operaciones pasan directo al repositorio original
  proponer(c: NuevaCancha) {
    return this.origen.proponer(c);
  }
  reemplazar(id: string, c: NuevaCancha) {
    return this.origen.reemplazar(id, c);
  }
  retirar(id: string) {
    return this.origen.retirar(id);
  }
  listarPendientes() {
    return this.origen.listarPendientes();
  }
  listarPublicadasDe(duenoId: string) {
    return this.origen.listarPublicadasDe(duenoId);
  }
  async revisar(id: string, aprobar: boolean, motivo?: string) {
    const r = await this.origen.revisar(id, aprobar, motivo);
    if (aprobar) this.invalidar();
    return r;
  }
}
