export type Sexo = "hembra" | "macho";
export type TipoSanidad = "mastitis" | "cojera" | "fiebre" | "entamborada" | "fiebre_leche";
export type Cuarto = "TDD" | "TDI" | "TTD" | "TTI";

export interface Advertencia {
  mensaje: string;
  hojas: string[];
}

/** Una fila de vaca tal como aparece en una planilla quincenal. */
export interface FilaHoja {
  fila: number;
  bloque: 1 | 2;
  chapeta: string | null;
  nombre: string;
  /** "FECHA PARTO ANTERIOS" (puede haber dos columnas en el bloque de secas). */
  partosAnteriores: string[];
  /** "FECHA CRIO": último parto. */
  fechaCrio: string | null;
  novilla: boolean;
  servicio: { fecha: string; toro: string | null; raza: string | null; inseminador: string | null } | null;
  palpacion: { fecha: string; prenada: boolean; palpador: string | null } | null;
  secado: string | null;
  aborto: boolean;
  lavado: boolean;
  mellizos: boolean;
  leche: { tarde: number | null; manana: number | null };
  sanidad: { tipos: TipoSanidad[]; cuartos: Cuarto[] };
  criaSexo: Sexo | null;
  /** Fecha escrita en la columna CRIO (en la planilla se usa para anotar abortos). */
  fechaEnCrio: string | null;
}

export interface HojaLeida {
  nombre: string;
  fechaCorte: string;
  filas: FilaHoja[];
  advertencias: string[];
}

export interface PartoPlan {
  fecha: string;
  criaSexo: Sexo | null;
  aborto: boolean;
  lavado: boolean;
  observaciones: string | null;
}

export interface ServicioPlan {
  fecha: string;
  toro: string | null;
  raza: string | null;
  inseminador: string | null;
}

export interface PalpacionPlan {
  fecha: string;
  diasPrenez: number | null;
  veterinario: string | null;
}

export interface OrdenoPlan {
  fecha: string;
  jornada: "am" | "pm";
  litros: number;
}

export interface SanidadPlan {
  fecha: string;
  tipo: TipoSanidad;
  cuartos: Cuarto[];
}

export interface AnimalPlan {
  clave: string;
  chapeta: string;
  nombre: string;
  primeraHoja: string;
  ultimaHoja: string;
  hojas: number;
  enUltimaHoja: boolean;
  partos: PartoPlan[];
  servicios: ServicioPlan[];
  palpaciones: PalpacionPlan[];
  secados: string[];
  ordenos: OrdenoPlan[];
  sanidad: SanidadPlan[];
}

export interface PlanImportacion {
  hojas: { nombre: string; fechaCorte: string; filas: number }[];
  desde: string | null;
  hasta: string | null;
  animales: AnimalPlan[];
  advertencias: Advertencia[];
}
