// Import relativo: estas funciones se prueban con vitest, que no resuelve el alias «@/».
import { hoyISO } from "../formato";
import { formatoNumero, diaMes } from "./resumen";
import { dosisConocidas } from "./servicios";
import type { Accion, Catalogo, IndiceCampo, Jornada, RegistroCola } from "./tipos";

/**
 * Una vaca no se puede ordeñar dos veces en la misma jornada.
 * El teléfono lo revisa con lo que ya conoce (sin señal): el catálogo descargado, la cola pendiente
 * y lo que ya se envió (historial). El respaldo final es el índice único (animal_id, fecha, jornada) del servidor.
 */

export const JORNADA_LARGA: Record<Jornada, string> = { am: "la mañana", pm: "la tarde" };

export const otraJornada = (j: Jornada): Jornada => (j === "am" ? "pm" : "am");

export const esJornada = (v: unknown): v is Jornada => v === "am" || v === "pm";

const clave = (animalId: string, fecha: string, jornada: string) => `${animalId}|${fecha}|${jornada}`;

const aLitros = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** `IndiceCampo`: el `Set` de claves ya registradas, con los litros y las dosis del día al lado. */
const armarIndice = (litros: ReadonlyMap<string, number | null>, dosis: ReadonlyMap<string, number>): IndiceCampo =>
  Object.assign(new Set<string>(litros.keys()), { litros, dosis });

/**
 * Lo que este teléfono ya conoce: los ordeños y los servicios del catálogo descargado y los de sus
 * propios registros (`registros` = cola pendiente + historial de enviados).
 *
 * Devuelve un `Set` de claves `animal|fecha|jornada` (los ordeños ya registrados) que además lleva
 * los litros de cada uno y las dosis de pajilla por día, para poder mostrarlos y contarlos sin señal.
 */
export function indiceOrdenos(registros: RegistroCola[], catalogo?: Catalogo | null): IndiceCampo {
  const litros = new Map<string, number | null>();
  // Lo primero que se conoce manda: el dato propio del teléfono no se pisa con el del catálogo.
  const anotar = (animalId: string, fecha: string, jornada: string, cantidad: number | null) => {
    const k = clave(animalId, fecha, jornada);
    if (litros.get(k) == null) litros.set(k, cantidad);
  };

  for (const r of registros) {
    const { fecha, jornada } = r.datos;
    if (typeof fecha !== "string" || !esJornada(jornada)) continue;
    if (r.accion === "ordeno" && typeof r.datos.animal_id === "string") anotar(r.datos.animal_id, fecha, jornada, aLitros(r.datos.litros));
    if (r.accion === "ordeno_lista" && Array.isArray(r.datos.items)) {
      for (const item of r.datos.items as { animal_id?: unknown; litros?: unknown }[]) {
        if (typeof item?.animal_id === "string") anotar(item.animal_id, fecha, jornada, aLitros(item.litros));
      }
    }
  }

  for (const a of catalogo?.animales ?? []) {
    for (const o of a.ordenos_recientes ?? []) anotar(a.id, o.fecha, o.jornada, aLitros(o.litros));
  }

  return armarIndice(litros, dosisConocidas(registros, catalogo));
}

export const yaOrdenada = (indice: Set<string>, animalId: string, fecha: string, jornada: Jornada) => indice.has(clave(animalId, fecha, jornada));

/** Litros de un ordeño ya registrado, o null si el teléfono sabe que está registrado pero no cuántos. */
export function litrosOrdeno(indice: Set<string>, animalId: string, fecha: string, jornada: Jornada): number | null {
  return (indice as Partial<IndiceCampo>).litros?.get(clave(animalId, fecha, jornada)) ?? null;
}

/** Litros de una jornada ya registrada tal como se leen en pantalla: «12,5 L» o «sin el dato». */
export const textoLitros = (litros: number | null) => (litros == null ? "sin el dato de litros" : `${formatoNumero(litros)} L`);

/**
 * El día de ordeño de una vaca tal como lo conoce el teléfono: qué jornadas están registradas, con
 * cuántos litros cada una y el total del día. Es lo que se muestra cuando ya no se puede registrar.
 */
export function resumenDiaOrdeno(indice: Set<string>, animalId: string, fecha: string) {
  const jornadas = (["am", "pm"] as const).map((jornada) => ({
    jornada,
    registrada: yaOrdenada(indice, animalId, fecha, jornada),
    litros: litrosOrdeno(indice, animalId, fecha, jornada),
  }));
  const registradas = jornadas.filter((j) => j.registrada);
  const conLitros = registradas.filter((j) => j.litros != null);
  return {
    jornadas,
    /** Cuántas de las dos jornadas del día ya están registradas. */
    cuantas: registradas.length,
    /** Las dos jornadas registradas: no se puede registrar más ese día. */
    completo: registradas.length === 2,
    /** Suma de los litros conocidos; null si ninguna jornada registrada trae la cantidad. */
    total: conLitros.length ? conLitros.reduce((s, j) => s + (j.litros ?? 0), 0) : null,
    /** Falta el dato de litros de alguna jornada registrada (catálogo descargado con una versión anterior). */
    incompletos: conLitros.length < registradas.length,
  };
}

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
