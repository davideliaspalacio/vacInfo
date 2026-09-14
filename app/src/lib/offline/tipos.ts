import type { Database } from "@/lib/database.types";

export const ACCIONES = [
  "ordeno",
  "ordeno_lista",
  "servicio",
  "palpacion",
  "parto",
  "secado",
  "salud",
  "destete",
  "baja",
  // Ya no se ofrece en VacDaTa; se conserva para registros que quedaron en cola.
  "pesaje",
  "carro_tanque",
  "consumo_diario",
  "mantenimiento",
  "aplicacion",
  "control_calidad",
  "movimiento_insumo",
  "visita",
  "rotacion",
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
  fecha_destete: string | null;
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

export type PotreroCatalogo = Database["public"]["Functions"]["estado_potreros"]["Returns"][number];

export type Catalogo = {
  finca_id: string;
  finca: FincaResumen;
  corte: string;
  animales: AnimalCatalogo[];
  potreros_estado: PotreroCatalogo[];
  dias_descanso_objetivo: number;
  grupos: string[];
  rotaciones_abiertas: { grupo: string; potrero_id: string; fecha_entrada: string; animales: number | null }[];
  bienes: { id: string; nombre: string; codigo: string }[];
  insumos: { nombre: string; categoria: string; unidad: string }[];
  toros: string[];
  descargado_en: string;
};

export type MensajeCampo = {
  id: string;
  texto: string;
  remitente: string;
  destinatario_id: string | null;
  leido: boolean;
  creado_en: string;
};

export type BandejaMensajes = { usuario_id: string; mensajes: MensajeCampo[]; descargado_en: string };

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
