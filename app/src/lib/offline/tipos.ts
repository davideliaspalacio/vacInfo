export const ACCIONES = [
  "ordeno",
  "ordeno_lista",
  "servicio",
  "palpacion",
  "parto",
  "secado",
  "salud",
  "pesaje",
  "carro_tanque",
  "consumo_diario",
] as const;

export type Accion = (typeof ACCIONES)[number];

export type FincaResumen = { id: string; nombre: string; municipio: string | null };

export type AnimalCatalogo = {
  id: string;
  codigo: string;
  chapeta: string | null;
  nombre: string;
  categoria: string;
  sexo: string;
  en_ordeno: boolean;
  prenada: boolean | null;
  dias_ordeno: number | null;
  ultimo_parto: string | null;
  ultimo_servicio: string | null;
  palpar_el: string | null;
  secar_el: string | null;
  parto_esperado: string | null;
  litros_am: number | null;
  litros_pm: number | null;
};

export type Catalogo = {
  finca_id: string;
  finca: FincaResumen;
  corte: string;
  animales: AnimalCatalogo[];
  potreros: { id: string; numero: number; nombre: string | null }[];
  insumos: { nombre: string; categoria: string; unidad: string }[];
  descargado_en: string;
};

export type RegistroCola = {
  cliente_id: string;
  accion: Accion;
  datos: Record<string, unknown>;
  finca_id: string;
  resumen: string;
  creado_en: string;
  intentos: number;
  estado: "pendiente" | "error";
  error: string | null;
  ultimo_intento: string | null;
};

export type RegistroHistorial = RegistroCola & {
  resultado: "ok" | "duplicado";
  mensaje: string | null;
  sincronizado_en: string;
};

/** Lo que viaja al servidor. */
export type RegistroEnviado = { cliente_id: string; accion: string; datos?: unknown };

export type ResultadoRegistro = { cliente_id: string; estado: "ok" | "duplicado" | "error"; mensaje?: string };
