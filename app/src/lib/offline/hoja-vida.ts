/**
 * Hoja de vida del animal: lo que se puede *ver* sin señal, sin registrar nada.
 *
 * Aquí no se recalcula el ciclo reproductivo: los días de ordeño, la mora de preñez, la fecha de secado
 * y el parto esperado salen tal cual de `estado_reproductivo` (vienen en el catálogo). Este archivo solo
 * los pone en palabras; si la función de la base cambia los números, la pantalla cambia con ella.
 *
 * Sin dependencias de Next ni de React para poder probarse con vitest.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
// Imports relativos: estas funciones se prueban con vitest, que no resuelve el alias «@/».
import { fecha as textoFecha, sumarDias } from "../formato";
import { leerMora } from "../mora";
import type { AnimalCatalogo, EventoSanitarioCatalogo, HojaVidaCatalogo, ParienteCatalogo } from "./tipos";

type Cliente = SupabaseClient<Database>;

/** Meses hacia atrás de los que viajan los eventos sanitarios: cuida el tamaño del catálogo. */
export const MESES_SANIDAD = 12;
/**
 * Eventos sanitarios por animal que viajan al teléfono (los más recientes).
 * Cada evento pesa unos 210 bytes, así que este tope es el que manda en el tamaño del catálogo:
 * con 4 son como mucho ~0,8 KB por animal (una finca de 500 animales crece ~400 KB en el peor caso).
 */
export const MAX_SANIDAD_ANIMAL = 4;
/** Tope de eventos sanitarios de toda la finca por descarga. */
export const MAX_SANIDAD = 4000;

/** Lo que se muestra cuando el teléfono tiene un catálogo viejo que todavía no trae estos datos. */
export const SIN_DESCARGA = "Descarga de nuevo los datos de la finca para ver esto";
/** Lo mismo, corto, para los datos sueltos: el aviso completo va una sola vez arriba de la pantalla. */
export const FALTA_DESCARGAR = "Falta descargar";

export const TIPO_SANITARIO: Record<Database["public"]["Enums"]["tipo_evento_sanitario"], string> = {
  enfermedad: "Enfermedad",
  tratamiento: "Tratamiento",
  vacuna: "Vacuna",
  mastitis: "Mastitis",
  cojera: "Cojera",
  fiebre: "Fiebre",
  entamborada: "Entamborada",
  fiebre_leche: "Fiebre de leche",
  cirugia: "Cirugía",
  desparasitacion: "Desparasitación",
};

export const ESTADO_SANITARIO: Record<Database["public"]["Enums"]["estado_sanitario"], string> = {
  activo: "Sin resolver",
  en_tratamiento: "En tratamiento",
  resuelto: "Resuelto",
};

// ─────────────────────────── Fechas ───────────────────────────

/** Primer día del que se traen eventos sanitarios (hoy menos `meses`). */
export function desdeSanidad(hoy: string, meses = MESES_SANIDAD) {
  const [anio, mes, dia] = hoy.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(anio, mes - 1 - meses, dia, 12)).toISOString().slice(0, 10);
}

/** Días completos entre dos fechas ISO (negativo si `hasta` es anterior a `desde`). */
export function diasEntre(desde: string, hasta: string) {
  const dia = 86_400_000;
  return Math.round((Date.parse(`${hasta.slice(0, 10)}T12:00:00Z`) - Date.parse(`${desde.slice(0, 10)}T12:00:00Z`)) / dia);
}

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;
export const dias = (n: number) => plural(n, "día", "días");

/** Edad en palabras: «8 meses», «3 años y 2 meses». null si no se conoce la fecha de nacimiento. */
export function edadTexto(nacimiento: string | null | undefined, hoy: string): string | null {
  if (!nacimiento) return null;
  const [an, mn, dn] = nacimiento.slice(0, 10).split("-").map(Number);
  const [ah, mh, dh] = hoy.slice(0, 10).split("-").map(Number);
  const meses = (ah - an) * 12 + (mh - mn) - (dh < dn ? 1 : 0);
  if (meses < 0) return null;
  if (meses < 12) return plural(meses, "mes", "meses");
  const anios = Math.floor(meses / 12);
  const resto = meses % 12;
  return `${plural(anios, "año", "años")}${resto ? ` y ${plural(resto, "mes", "meses")}` : ""}`;
}

// ─────────────────────────── Mora de preñez ───────────────────────────

/**
 * La mora de preñez en palabras grandes para el potrero. El número lo calcula `estado_reproductivo`
 * (aquí no se recalcula) y puede ser negativo (la vaca sigue en el descanso posparto), cero, positivo
 * (días de retraso) o nulo (no se cuenta porque el animal no está en ordeño).
 *
 * Quién es qué lo decide `lib/mora.ts`, que es el mismo criterio de la web: así los dos lados dicen
 * lo mismo. Aquí solo se elige el titular corto y se marca si va en rojo.
 */
export function textoMora(animal: Pick<AnimalCatalogo, "prenada" | "en_ordeno">, mora: number | null | undefined) {
  const leida = leerMora(mora, animal.prenada ?? false);
  if (!leida) {
    if (!animal.en_ordeno) return { valor: "No aplica", detalle: "Solo se cuenta mientras el animal está en ordeño.", alerta: false };
    return { valor: "Sin dato", detalle: null, alerta: false };
  }
  const detalle = `${leida.detalle}.`;
  const alerta = leida.nivel === "retraso" || leida.nivel === "retraso_alto";
  if (leida.nivel === "descanso") return { valor: "En descanso", detalle, alerta };
  if (leida.nivel === "al_dia") return { valor: "Al día", detalle, alerta };
  // Preñada: el contador quedó cerrado el día del servicio, así que es historia y no se pinta de rojo.
  if (leida.nivel === "congelada") return { valor: leida.dias > 0 ? `${dias(leida.dias)} de retraso` : leida.dias === 0 ? "Al día" : "Sin retraso", detalle, alerta };
  return { valor: `${dias(leida.dias)} de retraso`, detalle, alerta };
}

// ─────────────────────────── Retiro de leche ───────────────────────────

export type RetiroLeche = { hasta: string; faltan: number; producto: string | null; tipo: string };

/**
 * Retiro de leche vigente: la leche de esta vaca no se puede entregar hasta esa fecha.
 * El último día se cuenta como en las alertas de la base: (fecha_fin o fecha) + días de retiro.
 */
export function retiroVigente(sanidad: EventoSanitarioCatalogo[], hoy: string): RetiroLeche | null {
  let vigente: RetiroLeche | null = null;
  for (const e of sanidad) {
    if (!e.dias_retiro || e.dias_retiro <= 0) continue;
    const hasta = sumarDias(e.fecha_fin ?? e.fecha, e.dias_retiro);
    if (hasta < hoy) continue;
    if (vigente && vigente.hasta >= hasta) continue;
    vigente = { hasta, faltan: diasEntre(hoy, hasta) + 1, producto: e.producto, tipo: TIPO_SANITARIO[e.tipo] ?? e.tipo };
  }
  return vigente;
}

/** Aviso bien visible: esa leche no se puede entregar. */
export function textoRetiro(retiro: RetiroLeche) {
  const porQue = retiro.producto ? `por ${retiro.producto}` : `por ${retiro.tipo.toLowerCase()}`;
  return `No entregues la leche de esta vaca: está en retiro ${porQue} hasta el ${textoFecha(retiro.hasta, true)} (${dias(retiro.faltan)} más, contando hoy).`;
}

// ─────────────────────────── Armado del catálogo (servidor) ───────────────────────────

/** Fila de `eventos_sanitarios` tal como la pide `consultaSanidad`. */
export type FilaSanidad = EventoSanitarioCatalogo & { animal_id: string };

/** Eventos sanitarios de la finca desde `desde`, de la más nueva a la más vieja. */
export function consultaSanidad(supabase: Cliente, fincaId: string, desde: string) {
  return supabase
    .from("eventos_sanitarios")
    .select("animal_id, fecha, tipo, diagnostico, producto, cuartos, dias_retiro, fecha_fin, proxima_fecha, estado, animales!inner(finca_id)")
    .eq("animales.finca_id", fincaId)
    .gte("fecha", desde)
    .order("fecha", { ascending: false })
    .limit(MAX_SANIDAD);
}

/** Nombre y chapeta de todos los animales de la finca (también los dados de baja): sirve para resolver la mamá. */
export function consultaParientes(supabase: Cliente, fincaId: string) {
  return supabase.from("animales").select("id, nombre, chapeta").eq("finca_id", fincaId);
}

const ordenSanidad = (a: FilaSanidad, b: FilaSanidad) => b.fecha.localeCompare(a.fecha) || a.tipo.localeCompare(b.tipo);

/** Agrupa los eventos sanitarios por animal, lo más reciente primero y con tope por animal. */
export function agruparSanidad(filas: FilaSanidad[], maxPorAnimal = MAX_SANIDAD_ANIMAL) {
  const porAnimal = new Map<string, EventoSanitarioCatalogo[]>();
  for (const f of [...filas].sort(ordenSanidad)) {
    const lista = porAnimal.get(f.animal_id) ?? [];
    if (lista.length >= maxPorAnimal) continue;
    lista.push({
      fecha: f.fecha,
      tipo: f.tipo,
      diagnostico: f.diagnostico,
      producto: f.producto,
      cuartos: f.cuartos,
      dias_retiro: f.dias_retiro,
      fecha_fin: f.fecha_fin,
      proxima_fecha: f.proxima_fecha,
      estado: f.estado,
    });
    porAnimal.set(f.animal_id, lista);
  }
  return porAnimal;
}

/** Fila de `animales` con lo que hace falta para la mamá, el papá y la fecha de nacimiento. */
export type FilaParentesco = {
  fecha_nacimiento: string | null;
  madre_id: string | null;
  madre_nombre: string | null;
  madre_chapeta: string | null;
  padre_nombre: string | null;
  padre_chapeta: string | null;
};

const limpiar = (v: string | null | undefined) => {
  const t = v?.trim();
  return t ? t : null;
};

const pariente = (nombre: string | null, chapeta: string | null): ParienteCatalogo | null => {
  const n = limpiar(nombre);
  const c = limpiar(chapeta);
  return n || c ? { nombre: n, chapeta: c } : null;
};

/**
 * Bloque `hoja_vida` del catálogo. La mamá se toma de su propia ficha cuando está registrada
 * (así se ve su chapeta real, aunque esté dada de baja) y si no, del nombre escrito a mano.
 */
export function hojaVidaDe(
  fila: FilaParentesco,
  { mora_prenez, sanidad = [], fichas }: { mora_prenez: number | null; sanidad?: EventoSanitarioCatalogo[]; fichas?: Map<string, ParienteCatalogo> },
): HojaVidaCatalogo {
  const ficha = fila.madre_id ? fichas?.get(fila.madre_id) : undefined;
  return {
    fecha_nacimiento: fila.fecha_nacimiento,
    madre: (ficha && pariente(ficha.nombre, ficha.chapeta)) ?? pariente(fila.madre_nombre, fila.madre_chapeta),
    padre: pariente(fila.padre_nombre, fila.padre_chapeta),
    mora_prenez,
    sanidad,
  };
}

// ─────────────────────────── Vista (pantalla) ───────────────────────────

export type DatoHoja = { etiqueta: string; valor: string; detalle?: string | null; alerta?: boolean; sinDescarga?: boolean };

export type VistaHojaVida = {
  /** El catálogo del teléfono es anterior a la hoja de vida: hay que descargar de nuevo. */
  faltanDatos: boolean;
  identificacion: DatoHoja[];
  ciclo: DatoHoja[];
  sanidad: EventoSanitarioCatalogo[];
  retiro: RetiroLeche | null;
  sanidadDesde: string | null;
};

const soloVer = (etiqueta: string, valor: string | null | undefined, detalle?: string | null): DatoHoja => ({
  etiqueta,
  valor: valor || "Sin dato",
  detalle: detalle ?? null,
});

const textoPariente = (p: ParienteCatalogo | null) =>
  p ? [p.nombre, p.chapeta && `chapeta ${p.chapeta}`].filter(Boolean).join(" · ") : null;

/** Todo lo que la pantalla de hoja de vida tiene que mostrar, ya en palabras. */
export function armarHojaVida(animal: AnimalCatalogo, { hoy, sanidadDesde }: { hoy: string; sanidadDesde?: string | null }): VistaHojaVida {
  const hv = animal.hoja_vida ?? null;
  const faltanDatos = hv === null;
  const pendiente = (etiqueta: string): DatoHoja => ({ etiqueta, valor: FALTA_DESCARGAR, sinDescarga: true });

  const nacimiento = hv
    ? soloVer("Fecha de nacimiento", hv.fecha_nacimiento && textoFecha(hv.fecha_nacimiento, true), edadTexto(hv.fecha_nacimiento, hoy))
    : pendiente("Fecha de nacimiento");

  const identificacion: DatoHoja[] = [
    soloVer("Nombre", animal.nombre),
    soloVer("Chapeta", animal.chapeta ?? animal.codigo),
    nacimiento,
    hv ? soloVer("Mamá", textoPariente(hv.madre)) : pendiente("Mamá"),
    hv ? soloVer("Papá", textoPariente(hv.padre)) : pendiente("Papá"),
  ];

  const mora = hv ? textoMora(animal, hv.mora_prenez) : null;
  const ciclo: DatoHoja[] = [
    soloVer("Fecha del último parto", animal.ultimo_parto && textoFecha(animal.ultimo_parto, true)),
    soloVer("Días en ordeño", animal.dias_ordeno != null ? dias(animal.dias_ordeno) : null, animal.en_ordeno ? null : "No está en ordeño."),
    mora ? { etiqueta: "Mora de preñez", ...mora } : pendiente("Mora de preñez"),
    soloVer("Fecha servida", animal.ultimo_servicio && textoFecha(animal.ultimo_servicio, true)),
    soloVer("Fecha posible de secado", animal.secar_el && textoFecha(animal.secar_el, true)),
    soloVer("Posible fecha de nacimiento de la cría", animal.parto_esperado && textoFecha(animal.parto_esperado, true)),
  ];

  const sanidad = hv?.sanidad ?? [];
  return { faltanDatos, identificacion, ciclo, sanidad, retiro: retiroVigente(sanidad, hoy), sanidadDesde: sanidadDesde ?? null };
}
