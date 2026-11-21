import type { Database } from "@/lib/database.types";

export const ACCIONES = [
  "ordeno",
  "ordeno_lista",
  "servicio",
  "palpacion",
  "parto",
  "secado",
  "salud",
  // Ya no se ofrece en VacDaTa (el destete lo genera solo el sistema con `fincas.dias_destete`);
  // se conserva para las colas sin señal de teléfonos con la app vieja en caché.
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

export type Jornada = "am" | "pm";

/**
 * Ordeño que ya está registrado en el servidor (viene en el catálogo).
 * `litros` es opcional a propósito: los catálogos descargados con una versión anterior solo traen
 * la fecha y la jornada, y en ese caso la pantalla muestra «registrado» sin la cantidad.
 */
export type OrdenoRegistrado = { fecha: string; jornada: Jornada; litros?: number | null };

/**
 * Servicio ya registrado en el servidor (viene en el catálogo). Lo usa el teléfono para no pasarse
 * del tope de 2 dosis de pajilla por vaca y día sin señal.
 *
 * `toros` trae un elemento por dosis con el nombre del toro, o `""` cuando el servicio se registró
 * sin nombre. El nombre es lo que permite reconocer una dosis que el teléfono ya tenía contada en
 * su propio historial y no contarla dos veces.
 */
export type ServicioRegistrado = { fecha: string; toros: string[] };

/**
 * Lo que el teléfono ya sabe de los eventos registrados, para revisar las reglas sin señal.
 *
 * Es un `Set<string>` de claves `animal|fecha|jornada` (los ordeños ya registrados) para que las
 * pantallas que solo preguntan «¿ya está?» sigan funcionando igual, y lleva al lado los datos que
 * hacen falta para *mostrar* lo registrado y para contar las dosis del día:
 *   · `litros`: clave `animal|fecha|jornada` → litros de ese ordeño (null si no se conocen,
 *     p. ej. con un catálogo anterior que no traía la cantidad);
 *   · `dosis`: clave `animal|fecha` → dosis de pajilla que ya tiene la vaca ese día.
 */
export interface IndiceCampo extends Set<string> {
  readonly litros: ReadonlyMap<string, number | null>;
  readonly dosis: ReadonlyMap<string, number>;
}

/** Mamá o papá del animal, como se puede mostrar sin señal (nombre y chapeta, si se conocen). */
export type ParienteCatalogo = { nombre: string | null; chapeta: string | null };

/** Enfermedad, tratamiento o vacuna ya registrada (viene en el catálogo para la hoja de vida). */
export type EventoSanitarioCatalogo = {
  fecha: string;
  tipo: Database["public"]["Enums"]["tipo_evento_sanitario"];
  diagnostico: string | null;
  producto: string | null;
  cuartos: string[] | null;
  dias_retiro: number | null;
  /** Último día del tratamiento; si está vacío el retiro se cuenta desde `fecha`. */
  fecha_fin: string | null;
  proxima_fecha: string | null;
  estado: Database["public"]["Enums"]["estado_sanitario"];
};

/**
 * Datos de solo lectura de la hoja de vida que no se usan para registrar.
 * Viajan aparte para que un catálogo descargado con una versión anterior se reconozca enseguida:
 * si falta este bloque, la pantalla pide descargar de nuevo en vez de mostrar datos en blanco.
 */
export type HojaVidaCatalogo = {
  fecha_nacimiento: string | null;
  madre: ParienteCatalogo | null;
  padre: ParienteCatalogo | null;
  /** `estado_reproductivo.mora_prenez`: puede ser negativo (la vaca sigue en descanso) o nulo (no aplica). */
  mora_prenez: number | null;
  /** Enfermedades, tratamientos y vacunas recientes, de la más nueva a la más vieja. */
  sanidad: EventoSanitarioCatalogo[];
};

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
  /**
   * Ordeños ya registrados en el servidor de los últimos días (hoy y los anteriores, más el corte de la finca).
   * Opcional: los catálogos descargados con una versión anterior no lo traen y `completarCatalogo` lo deja en [].
   */
  ordenos_recientes?: OrdenoRegistrado[];
  /**
   * Servicios ya registrados en el servidor de los últimos días, con las dosis de pajilla de cada día.
   * Opcional: los catálogos descargados con una versión anterior no lo traen y entonces el teléfono
   * se guía por `ultimo_servicio` (sabe que ese día ya hay al menos una dosis, pero no si hay dos).
   */
  servicios_recientes?: ServicioRegistrado[];
  /**
   * Datos de la hoja de vida (solo para ver). Opcional: los catálogos descargados con una versión anterior
   * no lo traen y `completarCatalogo` lo deja en `null`, que la pantalla lee como «falta descargar de nuevo».
   */
  hoja_vida?: HojaVidaCatalogo | null;
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
  /**
   * Desde qué fecha vienen los eventos sanitarios de `animales[].hoja_vida.sanidad`.
   * Opcional: los catálogos descargados con una versión anterior no lo traen.
   */
  sanidad_desde?: string | null;
  /**
   * La finca rellena sola los ordeños que falten: los formularios registran siempre hoy, sin selector de fecha.
   * Opcional: los catálogos descargados con una versión anterior no lo traen y se asume `false`.
   */
  relleno_ordenos?: boolean;
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
