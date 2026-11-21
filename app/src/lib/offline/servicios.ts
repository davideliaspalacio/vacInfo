// Import relativo: estas funciones se prueban con vitest, que no resuelve el alias «@/».
import { hoyISO } from "../formato";
import { diaMes } from "./resumen";
import type { Accion, Catalogo, IndiceCampo, RegistroCola } from "./tipos";

/**
 * Dos pajillas por vaca y día, no más.
 *
 * El cliente: «solo se permiten dos dosis de pajillas por día, sin importar la hora ni la cantidad
 * (una en la mañana y una en la tarde, o dos en la mañana y cero en la tarde): el máximo son 2 por día».
 *
 * El teléfono lo revisa con lo que ya conoce (sin señal): el catálogo descargado, la cola pendiente
 * y lo que ya se envió (historial). El respaldo final es `registrar_servicio` en la base, que cuenta
 * las dosis de la fila del día antes de guardar (migración 20261121000025_segundo_toro.sql).
 *
 * Las dosis se cuentan **por el nombre del toro**, no sumando fuentes: una misma dosis aparece a la
 * vez en el catálogo (ya sincronizada) y en el historial del teléfono, y sumarlas bloquearía una
 * segunda pajilla que sí se puede registrar. Las dosis sin nombre de toro no se pueden distinguir
 * entre sí, así que de esas se toma la mayor cantidad que haya visto una sola fuente.
 */
export const MAX_DOSIS_DIA = 2;

export const claveDia = (animalId: string, fecha: string) => `${animalId}|${fecha}`;

const nombreToro = (v: unknown) => (typeof v === "string" ? v.trim().toLowerCase() : "");
const conTexto = (v: unknown) => typeof v === "string" && v.trim() !== "";

/** Los toros de un registro de servicio, uno por dosis: `""` cuando la dosis no trae nombre. */
export function torosDeServicio(datos: Record<string, unknown>): string[] {
  const segunda = conTexto(datos.toro2_nombre) || conTexto(datos.toro2_raza);
  return [nombreToro(datos.toro_nombre), ...(segunda ? [nombreToro(datos.toro2_nombre)] : [])];
}

/** Dosis de pajilla que trae un registro de servicio: la del toro 1 y, si viene, la del toro 2. */
export const dosisDeServicio = (datos: Record<string, unknown>) => torosDeServicio(datos).length;

/** Lo que se sabe de un día de una vaca mientras se cuentan las dosis. */
type Acumulado = {
  /** Toros distintos con dosis ese día. */
  nombres: Set<string>;
  /** Dosis sin nombre de toro: la mayor cantidad vista en una sola fuente (no se pueden distinguir). */
  anonimas: number;
  /** Mínimo de dosis que se sabe que hubo ese día aunque no se conozca cuáles (catálogo anterior). */
  piso: number;
};

/**
 * Dosis de pajilla que este teléfono ya conoce por vaca y día: las del catálogo descargado y las de
 * sus propios registros (`registros` = cola pendiente + historial de enviados).
 */
export function dosisConocidas(registros: RegistroCola[], catalogo?: Catalogo | null): Map<string, number> {
  const dias = new Map<string, Acumulado>();
  const dia = (clave: string) => {
    const actual = dias.get(clave) ?? { nombres: new Set<string>(), anonimas: 0, piso: 0 };
    dias.set(clave, actual);
    return actual;
  };
  const anotar = (animalId: string, fecha: string, toros: string[]) => {
    const d = dia(claveDia(animalId, fecha));
    let anonimas = 0;
    for (const t of toros) {
      if (t) d.nombres.add(t);
      else anonimas++;
    }
    d.anonimas = Math.max(d.anonimas, anonimas);
  };

  for (const a of catalogo?.animales ?? []) {
    if (a.servicios_recientes) {
      for (const s of a.servicios_recientes) anotar(a.id, s.fecha, s.toros.map(nombreToro));
    } else if (a.ultimo_servicio) {
      // Catálogo de una versión anterior: se sabe que ese día hubo servicio, no cuántas pajillas ni
      // de qué toros. Queda como piso de una dosis; el respaldo del servidor frena lo demás.
      dia(claveDia(a.id, a.ultimo_servicio)).piso = 1;
    }
  }

  for (const r of registros) {
    if (r.accion !== "servicio") continue;
    const { animal_id, fecha } = r.datos;
    if (typeof animal_id !== "string" || typeof fecha !== "string") continue;
    anotar(animal_id, fecha, torosDeServicio(r.datos));
  }

  return new Map([...dias].map(([clave, d]) => [clave, Math.max(d.nombres.size + d.anonimas, d.piso)]));
}

/** Dosis de pajilla que el teléfono ya conoce de esa vaca ese día. */
export function dosisDelDia(indice: Set<string>, animalId: string, fecha: string): number {
  return (indice as Partial<IndiceCampo>).dosis?.get(claveDia(animalId, fecha)) ?? 0;
}

/** «Esta vaca ya tiene 1 dosis de pajilla registrada hoy.» */
export function textoDosisDia(dosis: number, fecha: string, hoy = hoyISO()) {
  const cuando = fecha === hoy ? "hoy" : `el ${diaMes(fecha)}`;
  return `Esta vaca ya tiene ${dosis} ${dosis === 1 ? "dosis de pajilla registrada" : "dosis de pajilla registradas"} ${cuando}.`;
}

/** Motivo que se le muestra al trabajador cuando el registro pasaría del tope del día. */
export function textoExcesoDosis(yaTiene: number, nuevas: number, fecha: string, hoy = hoyISO()) {
  return `${textoDosisDia(yaTiene, fecha, hoy)} Solo se permiten ${MAX_DOSIS_DIA} dosis por día, sin importar la hora${
    nuevas > 1 ? ", y este registro trae 2 (toro 1 y toro 2)" : ""
  }.`;
}

/**
 * Revisión antes de encolar un servicio: devuelve el motivo para no guardar, o null si se puede.
 * Funciona igual sin señal porque solo mira las dosis que armó el teléfono.
 */
export function revisarDosisServicio(accion: Accion, datos: Record<string, unknown>, indice: Set<string>, hoy = hoyISO()): string | null {
  if (accion !== "servicio") return null;
  const { animal_id, fecha } = datos;
  if (typeof animal_id !== "string" || typeof fecha !== "string") return null;

  const yaTiene = dosisDelDia(indice, animal_id, fecha);
  const nuevas = dosisDeServicio(datos);
  return yaTiene + nuevas <= MAX_DOSIS_DIA ? null : textoExcesoDosis(yaTiene, nuevas, fecha, hoy);
}
