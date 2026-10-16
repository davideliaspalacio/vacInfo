// Import relativo: estas funciones se prueban con vitest, que no resuelve el alias «@/».
import { hoyISO } from "../formato";
import { diaMes } from "./resumen";
import type { Accion, Catalogo, Jornada, RegistroCola } from "./tipos";

/**
 * Una vaca no se puede ordeñar dos veces en la misma jornada.
 * El teléfono lo revisa con lo que ya conoce (sin señal): el catálogo descargado, la cola pendiente
 * y lo que ya se envió (historial). El respaldo final es el índice único (animal_id, fecha, jornada) del servidor.
 */

export const JORNADA_LARGA: Record<Jornada, string> = { am: "la mañana", pm: "la tarde" };

export const otraJornada = (j: Jornada): Jornada => (j === "am" ? "pm" : "am");

export const esJornada = (v: unknown): v is Jornada => v === "am" || v === "pm";

const clave = (animalId: string, fecha: string, jornada: string) => `${animalId}|${fecha}|${jornada}`;

/**
 * Ordeños que este teléfono ya conoce: los del catálogo descargado y los de sus propios registros
 * (`registros` = cola pendiente + historial de enviados).
 */
export function indiceOrdenos(registros: RegistroCola[], catalogo?: Catalogo | null): Set<string> {
  const indice = new Set<string>();

  for (const a of catalogo?.animales ?? []) {
    for (const o of a.ordenos_recientes ?? []) indice.add(clave(a.id, o.fecha, o.jornada));
  }

  for (const r of registros) {
    const { fecha, jornada } = r.datos;
    if (typeof fecha !== "string" || !esJornada(jornada)) continue;
    if (r.accion === "ordeno" && typeof r.datos.animal_id === "string") indice.add(clave(r.datos.animal_id, fecha, jornada));
    if (r.accion === "ordeno_lista" && Array.isArray(r.datos.items)) {
      for (const item of r.datos.items as { animal_id?: unknown }[]) {
        if (typeof item?.animal_id === "string") indice.add(clave(item.animal_id, fecha, jornada));
      }
    }
  }

  return indice;
}

export const yaOrdenada = (indice: Set<string>, animalId: string, fecha: string, jornada: Jornada) => indice.has(clave(animalId, fecha, jornada));

/** «Ya se registró el ordeño de la mañana de hoy». */
export function textoYaOrdenada(fecha: string, jornada: Jornada, hoy = hoyISO()) {
  return `Ya se registró el ordeño de ${JORNADA_LARGA[jornada]} ${fecha === hoy ? "de hoy" : `del ${diaMes(fecha)}`}.`;
}

/** «Ya se registró el ordeño de la mañana y de la tarde de hoy»: las dos jornadas del día. */
export function textoJornadasCompletas(fecha: string, hoy = hoyISO()) {
  return `Ya se registró el ordeño de la mañana y de la tarde ${fecha === hoy ? "de hoy" : `del ${diaMes(fecha)}`}.`;
}

/** Jornada que todavía se puede registrar ese día; null si ya están las dos. */
export function jornadaLibre(indice: Set<string>, animalId: string, fecha: string, preferida: Jornada): Jornada | null {
  if (!yaOrdenada(indice, animalId, fecha, preferida)) return preferida;
  const otra = otraJornada(preferida);
  return yaOrdenada(indice, animalId, fecha, otra) ? null : otra;
}

/**
 * Revisión antes de encolar: devuelve el motivo para no guardar, o null si se puede.
 * Funciona igual sin señal porque solo mira el índice que armó el teléfono.
 */
export function revisarOrdenoRepetido(accion: Accion, datos: Record<string, unknown>, indice: Set<string>, hoy = hoyISO()): string | null {
  if (accion !== "ordeno" && accion !== "ordeno_lista") return null;
  const { fecha, jornada } = datos;
  if (typeof fecha !== "string" || !esJornada(jornada)) return null;

  if (accion === "ordeno") {
    const animalId = datos.animal_id;
    if (typeof animalId !== "string" || !yaOrdenada(indice, animalId, fecha, jornada)) return null;
    return `${textoYaOrdenada(fecha, jornada, hoy)} No se puede registrar otro ordeño de la misma vaca en la misma jornada.`;
  }

  const items = Array.isArray(datos.items) ? (datos.items as { animal_id?: unknown }[]) : [];
  const repetidas = items.filter((i) => typeof i?.animal_id === "string" && yaOrdenada(indice, i.animal_id as string, fecha, jornada)).length;
  if (!repetidas) return null;
  return `${repetidas === 1 ? "1 vaca ya tiene" : `${repetidas} vacas ya tienen`} el ordeño de ${JORNADA_LARGA[jornada]} ${
    fecha === hoy ? "de hoy" : `del ${diaMes(fecha)}`
  } registrado. Quítalas de la lista (aparecen como «Ya ordeñada») y guarda de nuevo.`;
}
