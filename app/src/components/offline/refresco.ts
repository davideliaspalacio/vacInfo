/**
 * Cuándo toca volver a bajar el catálogo de la finca.
 *
 * Antes había un botón «Actualizar datos de la finca» y, además, una descarga automática si el
 * catálogo tenía más de 6 horas. El cliente pidió quitar el botón: ahora la descarga es automática
 * cada 2 minutos mientras haya señal, al abrir la pantalla, al volver a primer plano y al recuperar
 * la señal. Toda la decisión vive aquí, sin React ni DOM, para poder probarla sin navegador.
 */

/** Cada cuánto se baja el catálogo mientras haya señal (antes: 6 horas). */
export const INTERVALO_REFRESCO = 2 * 60_000;

/**
 * Cada cuánto se revisa si toca. Late más seguido que el intervalo a propósito: con un reloj de
 * 2 minutos exactos, un tic perdido deja el catálogo 4 minutos viejo.
 */
export const TIC_REFRESCO = 20_000;

/** Rato que se espera desde la última tecla antes de pisar los datos de la pantalla. */
export const GRACIA_TECLEO = 20_000;

export type EstadoRefresco = {
  /** `navigator.onLine` en el momento de decidir. */
  enLinea: boolean;
  /** Ya hay una descarga en curso: no se lanza otra. */
  descargando: boolean;
  /** El trabajador está escribiendo en un formulario: no se le pisan los datos. */
  escribiendo: boolean;
  /**
   * Último intento de descarga en milisegundos: lo más reciente entre el `descargado_en` del
   * catálogo guardado y el último intento que falló (para no reintentar en cada tic).
   * `null` cuando el teléfono todavía no tiene catálogo de esta finca.
   */
  ultimaDescarga: number | null;
  ahora: number;
  intervalo?: number;
};

/** ¿Toca bajar otra vez el catálogo de la finca? */
export function tocaRefrescar({
  enLinea,
  descargando,
  escribiendo,
  ultimaDescarga,
  ahora,
  intervalo = INTERVALO_REFRESCO,
}: EstadoRefresco): boolean {
  if (!enLinea) return false;
  if (descargando) return false;
  if (escribiendo) return false;
  if (ultimaDescarga === null) return true;
  const transcurrido = ahora - ultimaDescarga;
  // Fecha del teléfono movida hacia atrás: la marca queda «en el futuro» y no sirve para medir.
  if (transcurrido < 0) return true;
  return transcurrido >= intervalo;
}

type Enfocado = { tagName: string; isContentEditable?: boolean } | null;

const CAMPOS = new Set(["INPUT", "TEXTAREA", "SELECT"]);

/**
 * ¿El trabajador está escribiendo? Lo está si tiene el foco en un campo (aunque no teclee: puede
 * estar pensando o eligiendo en una lista) o si acabó de teclear hace menos de `gracia`.
 */
export function hayEdicionEnCurso(enfocado: Enfocado, ultimoTecleo: number, ahora: number, gracia = GRACIA_TECLEO): boolean {
  if (enfocado && (CAMPOS.has(enfocado.tagName.toUpperCase()) || enfocado.isContentEditable === true)) return true;
  if (ultimoTecleo <= 0) return false;
  return ahora - ultimoTecleo < gracia;
}
