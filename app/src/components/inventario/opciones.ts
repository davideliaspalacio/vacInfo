export type EstadoAccion = { ok?: boolean; error?: string; mensaje?: string };

export const CATEGORIAS_INSUMO = ["concentrado", "sal", "mineral", "abono", "cal", "fertilizante", "veneno", "medicamento", "aseo", "semen", "otro"] as const;
export type CategoriaInsumo = (typeof CATEGORIAS_INSUMO)[number];

export const ETIQUETA_CATEGORIA: Record<CategoriaInsumo, string> = {
  concentrado: "Concentrado",
  sal: "Sal",
  mineral: "Mineral",
  abono: "Abono",
  cal: "Cal",
  fertilizante: "Fertilizante",
  veneno: "Veneno",
  medicamento: "Medicamento",
  aseo: "Aseo",
  semen: "Semen",
  otro: "Otro",
};

export const FUENTES_CONSUMO = ["concentrado_vacas", "sal_vacas", "concentrado_terneras", "sal_terneras"] as const;
export type FuenteConsumo = (typeof FUENTES_CONSUMO)[number];

export const ETIQUETA_FUENTE: Record<FuenteConsumo, string> = {
  concentrado_vacas: "Concentrado vacas",
  sal_vacas: "Sal vacas",
  concentrado_terneras: "Concentrado terneras",
  sal_terneras: "Sal terneras",
};

export type Insumo = {
  id: string;
  nombre: string;
  categoria: CategoriaInsumo;
  unidad: string;
  contenido: number | null;
  precio: number | null;
  stock_minimo: number | null;
  consumo_diario_fuente: string | null;
};
