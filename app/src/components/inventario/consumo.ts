export const MODOS_CONSUMO = ["fijo", "por_animal"] as const;
export const PERIODOS_CONSUMO = ["dia", "mes", "anio"] as const;
export const GRUPOS_CONSUMO = ["vacas_ordeno", "vacas_horras", "levante", "todos"] as const;

export type ModoConsumo = (typeof MODOS_CONSUMO)[number];
export type PeriodoConsumo = (typeof PERIODOS_CONSUMO)[number];
export type GrupoConsumo = (typeof GRUPOS_CONSUMO)[number];

export type ReglaConsumo = {
  id: string;
  insumo_id: string;
  modo: ModoConsumo;
  cantidad: number;
  en_kg: boolean;
  periodo: PeriodoConsumo;
  grupo: GrupoConsumo | null;
  desde: string;
  hasta: string | null;
  activo: boolean;
  notas: string | null;
};

export type InsumoRegla = { id: string; nombre: string; unidad: string; contenido: number | null };

export type ConteosGrupo = Record<GrupoConsumo, number>;

/** Igual que en saldo_insumos: un mes son 30 días y un año 365. */
export const DIAS_PERIODO: Record<PeriodoConsumo, number> = { dia: 1, mes: 30, anio: 365 };

export const ETIQUETA_PERIODO: Record<PeriodoConsumo, string> = { dia: "día", mes: "mes", anio: "año" };

export const ETIQUETA_GRUPO: Record<GrupoConsumo, string> = {
  vacas_ordeno: "Vacas en ordeño",
  vacas_horras: "Vacas horras",
  levante: "Terneras y novillas de levante",
  todos: "Todos los animales",
};

const POR_CADA: Record<GrupoConsumo, string> = {
  vacas_ordeno: "vaca en ordeño",
  vacas_horras: "vaca horra",
  levante: "animal de levante",
  todos: "animal",
};

const formato = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 3 });
export const cantidad = (v: number) => formato.format(v);

export function plural(unidad: string, n: number) {
  if (n === 1 || unidad === "kg") return unidad;
  return /[aeiouáéíóú]$/i.test(unidad) ? `${unidad}s` : `${unidad}es`;
}

type Descripcion = Pick<ReglaConsumo, "cantidad" | "en_kg" | "modo" | "grupo" | "periodo">;

/** "Sal mineralizada: 0,5 bultos por día" · "Concentrado vacas leche: 3 kg por vaca en ordeño por día" */
export function describirRegla(regla: Descripcion, insumo?: InsumoRegla) {
  const unidad = regla.en_kg ? "kg" : plural(insumo?.unidad ?? "unidad", regla.cantidad);
  const porAnimal = regla.modo === "por_animal" && regla.grupo ? ` por ${POR_CADA[regla.grupo]}` : "";
  return `${insumo?.nombre ?? "Insumo"}: ${cantidad(regla.cantidad)} ${unidad}${porAnimal} por ${ETIQUETA_PERIODO[regla.periodo]}`;
}

/** Unidades del insumo que descuenta la regla en un día con los animales dados. */
export function unidadesPorDia(regla: Descripcion, insumo: InsumoRegla | undefined, conteos: ConteosGrupo | null) {
  const porDia = regla.cantidad / DIAS_PERIODO[regla.periodo];
  const enUnidades = regla.en_kg ? (insumo?.contenido ? porDia / insumo.contenido : null) : porDia;
  if (enUnidades == null) return null;
  if (regla.modo === "fijo") return enUnidades;
  return conteos && regla.grupo ? enUnidades * conteos[regla.grupo] : null;
}

export function estadoRegla(regla: Pick<ReglaConsumo, "activo" | "desde" | "hasta">, corte: string) {
  if (!regla.activo) return { texto: "Anulada", tono: "gris" } as const;
  if (regla.hasta && regla.hasta < corte) return { texto: "Terminada", tono: "gris" } as const;
  if (regla.desde > corte) return { texto: "Programada", tono: "azul" } as const;
  return { texto: "Activa", tono: "verde" } as const;
}
