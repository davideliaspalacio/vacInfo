/**
 * Lectura de la «PLANILLA IMPLEMENTACIÓN SERES VIVOS»: el listado en papel con el que el cliente
 * da de alta todos los animales de una finca de una sola vez.
 *
 * Columnas de la planilla del cliente, en su orden: #, ESPECIE, RAZA, COLOR, HEMBRA O MACHO, NOMBRE,
 * FECHA NACIMIENTO, CHAPETA, PESO, PAPÁ, CHAPETA PAPÁ, MAMÁ, CHAPETA MAMÁ y el bloque
 * «DATOS DE VACAS PRODUCTIVOS» con FECHA ÚLTIMO PARTO, DÍAS ORDEÑO, MORA PREÑEZ, FECHA SERVIDA,
 * FECHA POSIBLE DE SECADO y POSIBLE FECHA NACIMIENTO CRÍA. Nuestra plantilla agrega al final dos
 * columnas opcionales propias: EN ORDEÑO y LITROS ÚLTIMO ORDEÑO.
 *
 * Del bloque de vacas productivas **solo se capturan dos datos**: FECHA ÚLTIMO PARTO (crea el parto
 * de historial) y FECHA SERVIDA (crea el servicio). Los otros cuatro —DÍAS ORDEÑO, MORA PREÑEZ,
 * FECHA POSIBLE DE SECADO y POSIBLE FECHA NACIMIENTO CRÍA— los calcula el sistema a partir del parto
 * y del servicio y no se guardan: si el ganadero escribió algo ahí, se lee sin romper y se avisa.
 *
 * Los nombres viejos de nuestra plantilla (SEXO, PADRE, MADRE, ÚLTIMO PARTO…) siguen valiendo: el
 * mapeo es por el texto del encabezado, así que las planillas ya repartidas se importan igual.
 *
 * Igual que la planilla quincenal (`leer.ts`), las columnas se reconocen por el texto de su
 * encabezado —sin tildes y en mayúsculas— y no por su posición, así que sirven planillas con las
 * columnas movidas, renombradas o con columnas propias del cliente en medio.
 *
 * Este módulo no habla con Supabase: devuelve un plan que `seres-vivos-aplicar.ts` compara con la
 * finca y luego inserta.
 */
import ExcelJS from "exceljs";
import { leerFecha, leerNumero, texto, valor } from "./celdas";
import { normalizarChapeta, normalizarEncabezado, normalizarNombre, normalizarRaza, titulo } from "./normalizar";

export type Especie = "bovino" | "equino" | "canino" | "ave" | "otro";
export type Sexo = "hembra" | "macho";
export type Categoria = "vaca" | "novilla" | "novillo" | "ternera" | "ternero" | "toro" | "caballo" | "perro" | "otro";

export const TITULO_PLANILLA = "PLANILLA IMPLEMENTACIÓN SERES VIVOS";
export const HOJA_SERES_VIVOS = "Seres vivos";
export const FILAS_PLANTILLA = 75;
export const PESO_MAXIMO = 1500;
/** Litros de un solo ordeño (una jornada). Por encima de esto es un error de digitación. */
export const LITROS_MAXIMO = 60;

/** Encabezados exactos de la planilla del cliente, en orden. */
export const COLUMNAS_PLANILLA = [
  "#",
  "ESPECIE",
  "RAZA",
  "COLOR",
  "HEMBRA O MACHO",
  "NOMBRE",
  "FECHA NACIMIENTO",
  "CHAPETA",
  "PESO",
  "PAPÁ",
  "CHAPETA PAPÁ",
  "MAMÁ",
  "CHAPETA MAMÁ",
  // Bloque «DATOS DE VACAS PRODUCTIVOS» de la planilla del cliente.
  "FECHA ÚLTIMO PARTO",
  "DÍAS ORDEÑO",
  "MORA PREÑEZ",
  "FECHA SERVIDA",
  "FECHA POSIBLE DE SECADO",
  "POSIBLE FECHA NACIMIENTO CRÍA",
  // Dos columnas propias nuestras, al final para no mover las de la planilla en papel.
  "EN ORDEÑO",
  "LITROS ÚLTIMO ORDEÑO",
] as const;

/** Título del bloque que el cliente dibuja encima de las seis columnas de vacas productivas. */
export const TITULO_BLOQUE_PRODUCTIVAS = "DATOS DE VACAS PRODUCTIVOS";

/** Las seis columnas del bloque «DATOS DE VACAS PRODUCTIVOS», en el orden del cliente. */
export const COLUMNAS_PRODUCTIVAS = [
  "FECHA ÚLTIMO PARTO",
  "DÍAS ORDEÑO",
  "MORA PREÑEZ",
  "FECHA SERVIDA",
  "FECHA POSIBLE DE SECADO",
  "POSIBLE FECHA NACIMIENTO CRÍA",
] as const;

/** Las cuatro del bloque que el sistema calcula solo: se leen, se avisan y no se guardan. */
export const COLUMNAS_CALCULADAS = ["DÍAS ORDEÑO", "MORA PREÑEZ", "FECHA POSIBLE DE SECADO", "POSIBLE FECHA NACIMIENTO CRÍA"] as const;

/** Columnas opcionales de historial: una planilla sin ellas se sigue leyendo igual. */
export const COLUMNAS_HISTORIAL = ["FECHA ÚLTIMO PARTO", "FECHA SERVIDA", "EN ORDEÑO", "LITROS ÚLTIMO ORDEÑO"] as const;

/** Nombres de especie que se ofrecen en la plantilla (la lectura acepta más variantes). */
export const ESPECIES_ACEPTADAS = ["Bovino", "Equino", "Canino", "Ave", "Otro"] as const;

/** Especie como se escribe en las advertencias. */
export const ETIQUETA_ESPECIE: Record<string, string> = {
  bovino: "Bovino",
  equino: "Equino",
  canino: "Canino",
  ave: "Ave",
  otro: "Otro",
};

type Campo =
  | "numero"
  | "especie"
  | "raza"
  | "color"
  | "sexo"
  | "nombre"
  | "fechaNacimiento"
  | "chapeta"
  | "peso"
  | "padre"
  | "chapetaPadre"
  | "madre"
  | "chapetaMadre"
  | "ultimoParto"
  | "fechaServida"
  | "enOrdeno"
  | "litrosOrdeno"
  // Las cuatro que el sistema calcula: se reconocen para no confundirlas con otras y se ignoran.
  | "diasOrdeno"
  | "moraPrenez"
  | "fechaSecado"
  | "partoEsperado";

/** Los cuatro campos del bloque productivo que no se guardan, con el título con que se avisan. */
export const CAMPOS_CALCULADOS: Record<"diasOrdeno" | "moraPrenez" | "fechaSecado" | "partoEsperado", string> = {
  diasOrdeno: "DÍAS ORDEÑO",
  moraPrenez: "MORA PREÑEZ",
  fechaSecado: "FECHA POSIBLE DE SECADO",
  partoEsperado: "POSIBLE FECHA NACIMIENTO CRÍA",
};

/**
 * Campo al que corresponde un encabezado. Acepta los nombres nuevos del cliente (HEMBRA O MACHO,
 * PAPÁ, MAMÁ, FECHA ÚLTIMO PARTO, FECHA SERVIDA…) y los viejos de nuestra plantilla (SEXO, PADRE,
 * MADRE, ÚLTIMO PARTO…).
 *
 * El orden importa:
 *  - las cuatro columnas calculadas se resuelven antes que las parecidas («DÍAS ORDEÑO» antes que
 *    «EN ORDEÑO», «POSIBLE FECHA NACIMIENTO CRÍA» antes que «FECHA NACIMIENTO», «FECHA POSIBLE DE
 *    SECADO» antes que cualquier otra fecha);
 *  - «CHAPETA PAPÁ» y «NOMBRE DE LA MAMÁ» antes que «CHAPETA» y «NOMBRE».
 */
export function campoDeEncabezado(encabezado: string): Campo | null {
  const h = normalizarEncabezado(encabezado)
    .replace(/[.:]+$/, "")
    .trim();
  if (!h) return null;
  if (/^(#|N|N°|NO|NRO|NUM|NUMERO|ITEM|ORDEN)$/.test(h)) return "numero";
  if (/^ESPECIE/.test(h)) return "especie";
  // Sexo: «SEXO», «HEMBRA O MACHO», «H/M»… (el cliente escribe la pregunta completa).
  if (/^(SEXO|HEMBRA|MACHO|H ?\/ ?M|M ?\/ ?H|H O M|M O H)/.test(h)) return "sexo";
  if (/^COLOR/.test(h)) return "color";
  if (/^PESO/.test(h)) return "peso";

  // ── Las cuatro que el sistema calcula: primero, porque su texto choca con otras columnas ──
  if (/^(DIAS|D[IÍ]AS)( EN)? ORDE(Ñ|N)O/.test(h) || /^DIAS (DE )?LECHE/.test(h)) return "diasOrdeno";
  if (/MORA/.test(h)) return "moraPrenez";
  if (/SECADO|SECAR/.test(h)) return "fechaSecado";
  if (/CRIA|CRÍA/.test(h)) return "partoEsperado";

  // Historial: «LITROS…» antes que «ORDEÑO» porque «LITROS ÚLTIMO ORDEÑO» contiene las dos palabras.
  if (/LITROS/.test(h)) return "litrosOrdeno";
  if (/ORDE(Ñ|N)O/.test(h)) return "enOrdeno";
  if (/PARTO/.test(h)) return "ultimoParto";
  // «FECHA SERVIDA», «SERVIDA EL», «FECHA DE SERVICIO», «ÚLTIMO SERVICIO», «MONTA»…
  if (/SERVI|MONTA|INSEMINA/.test(h)) return "fechaServida";
  if (/^(FECHA (DE )?NACIMIENTO|FECHA NAC|NACIMIENTO|NACIO)/.test(h)) return "fechaNacimiento";
  if (/PADRE|PAPA/.test(h)) return /CHAPETA/.test(h) ? "chapetaPadre" : /^(NOMBRE (DEL )?)?(PADRE|PAPA)$/.test(h) ? "padre" : null;
  if (/MADRE|MAMA/.test(h)) return /CHAPETA/.test(h) ? "chapetaMadre" : /^(NOMBRE (DE LA )?)?(MADRE|MAMA)$/.test(h) ? "madre" : null;
  if (/^CHAPETA/.test(h)) return "chapeta";
  if (/^RAZA/.test(h)) return "raza";
  if (/^NOMBRE/.test(h)) return "nombre";
  return null;
}

const ESPECIES: [RegExp, Especie][] = [
  [/^(BOVIN|VACUN|VACA|RES$|RESES|GANADO|NOVILL|TERNER|TORO|BUEY)/, "bovino"],
  [/^(EQUIN|CABALL|YEGUA|POTR|MULA|MULAR|ASNO|BURR)/, "equino"],
  [/^(CANIN|PERR|CAN$)/, "canino"],
  [/^(AVE|GALLIN|GALL|POLL|PATO|PAVO)/, "ave"],
];

/** Especie a partir del texto de la columna ESPECIE. `null` = no se reconoció. */
export function especieDeTexto(v: string | null): Especie | null {
  if (!v) return null;
  const t = normalizarEncabezado(v);
  for (const [patron, especie] of ESPECIES) if (patron.test(t)) return especie;
  return null;
}

const HEMBRA = /^(HEMBRA|H$|F$|FEMENIN|VACA|NOVILLA|TERNERA|YEGUA|PERRA|GALLINA)/;
const MACHO = /^(MACHO|M$|MASCULIN|TORO|TORETE|NOVILLO|TERNERO|CABALLO|POTRO|PERRO|GALLO)/;

/** Sexo a partir del texto de la columna SEXO. `null` = vacío o no se reconoció. */
export function sexoDeTexto(v: string | null): Sexo | null {
  if (!v) return null;
  const t = normalizarEncabezado(v);
  if (HEMBRA.test(t)) return "hembra";
  if (MACHO.test(t)) return "macho";
  return null;
}

const SI = /^(SI|S|X|OK|YES|Y|TRUE|VERDADERO|1|EN ORDEÑO|EN ORDENO|ORDEÑANDO|ORDENANDO|ORDEÑO|ORDENO|LACTANCIA|EN LACTANCIA|PRODUCIENDO)$/;
const NO = /^(NO|N|FALSE|FALSO|0|SECA|SECO|SECAS|HORRA|HORRAS|SIN ORDEÑO|SIN ORDENO|NO ORDEÑA|NO ORDENA)$/;

/** Sí / no de la columna EN ORDEÑO. `null` = vacío o no se entendió. */
export function siNoDeTexto(v: string | null): boolean | null {
  if (!v) return null;
  const t = normalizarEncabezado(v).replace(/[.]+$/, "");
  if (SI.test(t)) return true;
  if (NO.test(t)) return false;
  return null;
}

/** Meses completos entre dos fechas ISO. */
export function mesesEntre(desde: string, hasta: string) {
  const [a1, m1, d1] = desde.split("-").map(Number);
  const [a2, m2, d2] = hasta.split("-").map(Number);
  return (a2 - a1) * 12 + (m2 - m1) - (d2 < d1 ? 1 : 0);
}

/**
 * Etapa del animal al importar, con la misma regla que `etapa_de_animal` en la base:
 * si la fila trae ÚLTIMO PARTO la hembra es vaca (el hecho manda sobre la edad); si no,
 * decide la edad: hembra < 12 meses ternera, 12–36 novilla y > 36 vaca; macho < 12 ternero,
 * 12–24 novillo y > 24 toro. Sin fecha de nacimiento la hembra queda vaca y el macho toro.
 * Caballo, perro y cualquier otra especie van a su propia categoría.
 *
 * El corte de la hembra son 36 meses y no 24 porque una novilla que todavía no han servido
 * no debe volverse vaca sola; a los 36 sin un solo dato ya es un animal cargado sin historial.
 */
export function categoriaDerivada(especie: Especie, sexo: Sexo, fechaNacimiento: string | null, hoy: string, tieneParto = false): Categoria {
  if (especie === "equino") return "caballo";
  if (especie === "canino") return "perro";
  if (especie !== "bovino") return "otro";
  if (tieneParto && sexo === "hembra") return "vaca"; // el hecho manda sobre la edad
  if (!fechaNacimiento) return sexo === "hembra" ? "vaca" : "toro";
  const meses = Math.max(0, mesesEntre(fechaNacimiento, hoy));
  if (meses < 12) return sexo === "hembra" ? "ternera" : "ternero";
  // Hembras: novilla hasta los 36 meses. Sin un solo dato, a esa edad ya es una vaca
  // cargada sin historial. Machos: novillo hasta los 24. Misma regla que `etapa_de_animal`.
  if (sexo === "hembra") return meses <= 36 ? "novilla" : "vaca";
  return meses <= 24 ? "novillo" : "toro";
}

export interface FilaSerVivo {
  /** Fila dentro de la hoja de Excel, para que el usuario la encuentre. */
  fila: number;
  /** Número de la columna «#», si venía. */
  numero: number | null;
  nombre: string;
  chapeta: string | null;
  especie: Especie;
  sexo: Sexo;
  categoria: Categoria;
  raza: string | null;
  color: string | null;
  fechaNacimiento: string | null;
  pesoKg: number | null;
  padreNombre: string | null;
  padreChapeta: string | null;
  madreNombre: string | null;
  madreChapeta: string | null;
  /** Fecha del último parto (historial, sin cría). `null` = la planilla no la trajo o no sirve. */
  ultimoParto: string | null;
  /** Fecha servida: crea el servicio del animal. `null` = la planilla no la trajo o no sirve. */
  fechaServida: string | null;
  /** `true` en ordeño, `false` seca, `null` = la planilla no lo dijo. */
  enOrdeno: boolean | null;
  /** Litros del último ordeño (una jornada). */
  litrosOrdeno: number | null;
  /** Clave de deduplicación: chapeta normalizada si hay, si no el nombre normalizado. */
  clave: string;
}

export interface PlanSeresVivos {
  hoja: string;
  /** Texto escrito junto a «PERTENECEN A FINCA:», si venía. */
  fincaEnArchivo: string | null;
  /** Fecha con la que se calculan las categorías y se registran los pesajes y los ordeños. */
  fecha: string;
  /** `true` si la planilla trae alguna columna de historial (parto, servida, ordeño o litros). */
  conHistorial: boolean;
  /** Títulos de las columnas calculadas que venían con algo escrito: se avisa que no se guardan. */
  calculadasConDatos: string[];
  filas: FilaSerVivo[];
  /** Filas con datos que no se pueden importar (sin nombre ni chapeta, chapeta repetida, sexo ilegible). */
  omitidas: number;
  advertencias: string[];
}

export const claveFila = (chapeta: string | null, nombre: string) =>
  normalizarChapeta(chapeta) ? `C:${normalizarChapeta(chapeta)}` : `N:${normalizarNombre(nombre)}`;

const MINIMO_COLUMNAS = 3;

type Columnas = Map<Campo, number>;

/** Columnas de la fila si parece el encabezado de la tabla de seres vivos. */
function encabezadosDe(fila: ExcelJS.Row): Columnas | null {
  const columnas: Columnas = new Map();
  fila.eachCell((celda, c) => {
    const t = texto(valor(celda));
    const campo = t ? campoDeEncabezado(t) : null;
    if (campo && !columnas.has(campo)) columnas.set(campo, c);
  });
  // Tiene que identificar al animal y traer al menos una columna propia de esta planilla, para no
  // confundirla con la hoja de una planilla quincenal (que también tiene CHAPETA y NOMBRE).
  const identifica = columnas.has("nombre") || columnas.has("chapeta");
  const propia = (["especie", "sexo", "fechaNacimiento", "peso", "chapetaMadre", "chapetaPadre"] as Campo[]).some((c) => columnas.has(c));
  return identifica && propia && columnas.size >= MINIMO_COLUMNAS ? columnas : null;
}

/** Nombre de la finca escrito junto a «PERTENECEN A FINCA:» en las filas de arriba. */
function fincaDeEncabezado(ws: ExcelJS.Worksheet, hasta: number): string | null {
  for (let r = 1; r < hasta; r++) {
    const fila = ws.getRow(r);
    const textos: (string | null)[] = [];
    for (let c = 1; c <= Math.max(fila.cellCount, 1); c++) textos[c] = texto(valor(fila.getCell(c)));
    const etiqueta = textos.findIndex((t) => t && /^PERTENECEN A (LA )?FINCA/.test(normalizarEncabezado(t)));
    if (etiqueta < 0) continue;
    const resto = (textos[etiqueta] ?? "").split(":").slice(1).join(":").trim();
    if (resto) return resto;
    return textos.slice(etiqueta + 1).find((t): t is string => !!t) ?? null;
  }
  return null;
}

/** Lee la primera hoja del libro que tenga la tabla de seres vivos. */
export function leerHojaSeresVivos(ws: ExcelJS.Worksheet, hoy: string): PlanSeresVivos | null {
  let columnas: Columnas | null = null;
  let filaEncabezados = 0;
  for (let r = 1; r <= Math.min(ws.rowCount, 30); r++) {
    const encontradas = encabezadosDe(ws.getRow(r));
    if (encontradas) {
      columnas = encontradas;
      filaEncabezados = r;
      break;
    }
  }
  if (!columnas) return null;

  const advertencias: string[] = [];
  const filas: FilaSerVivo[] = [];
  const vistas = new Map<string, number>();
  let omitidas = 0;
  /** Columnas calculadas en las que el ganadero escribió algo (se leen y no se guardan). */
  const calculadasConDatos = new Set<string>();

  const faltantes = (["especie", "sexo", "nombre", "chapeta", "fechaNacimiento"] as Campo[]).filter((c) => !columnas!.has(c));
  if (faltantes.length) {
    const nombres: Record<string, string> = {
      especie: "ESPECIE",
      sexo: "SEXO",
      nombre: "NOMBRE",
      chapeta: "CHAPETA",
      fechaNacimiento: "FECHA NACIMIENTO",
    };
    advertencias.push(`La planilla no tiene la columna ${faltantes.map((f) => nombres[f]).join(", ")}: esos datos quedarán vacíos.`);
  }

  for (let r = filaEncabezados + 1; r <= ws.rowCount; r++) {
    const fila = ws.getRow(r);
    const dato = (campo: Campo) => {
      const c = columnas!.get(campo);
      return c ? valor(fila.getCell(c)) : null;
    };
    const t = (campo: Campo) => texto(dato(campo));

    // Las cuatro columnas calculadas se leen solo para avisar: nunca se guardan.
    for (const [campo, titulo] of Object.entries(CAMPOS_CALCULADOS)) if (t(campo as Campo) != null) calculadasConDatos.add(titulo);

    const nombreTxt = t("nombre");
    const chapetaTxt = t("chapeta");
    const numero = leerNumero(dato("numero"));
    // Fila vacía (o solo con el número de orden de la plantilla): se salta sin avisar.
    const conDatos = (
      [
        "especie",
        "raza",
        "color",
        "sexo",
        "nombre",
        "fechaNacimiento",
        "chapeta",
        "peso",
        "padre",
        "chapetaPadre",
        "madre",
        "chapetaMadre",
      ] as Campo[]
    ).some((campo) => t(campo) != null);
    if (!conDatos) continue;

    if (!nombreTxt && !chapetaTxt) {
      advertencias.push(`Fila ${r}: no tiene nombre ni chapeta, no se puede identificar al animal; se omitió.`);
      omitidas++;
      continue;
    }

    const chapeta = chapetaTxt ? chapetaTxt.replace(/\.0+$/, "") : null;
    const nombre = nombreTxt ? titulo(nombreTxt) : chapeta!;
    if (!nombreTxt) advertencias.push(`Fila ${r}: no tiene nombre; se usará la chapeta ${chapeta} como nombre.`);
    const quien = `Fila ${r} (${nombre}${chapeta ? ` · chapeta ${chapeta}` : ""})`;

    const clave = claveFila(chapeta, nombre);
    const repetida = vistas.get(clave);
    if (repetida) {
      advertencias.push(
        chapeta
          ? `${quien}: la chapeta ${chapeta} ya aparece en la fila ${repetida} de la planilla; se omitió la fila ${r}.`
          : `${quien}: el nombre ya aparece en la fila ${repetida} de la planilla y no tiene chapeta; se omitió la fila ${r}.`,
      );
      omitidas++;
      continue;
    }

    const especieTxt = t("especie");
    let especie = especieDeTexto(especieTxt);
    if (!especie) {
      if (!especieTxt) {
        especie = "bovino";
        advertencias.push(`${quien}: no dice la especie; se tomó como bovino.`);
      } else {
        especie = "otro";
        advertencias.push(`${quien}: no se reconoció la especie «${especieTxt}»; quedará en la categoría Otro.`);
      }
    }

    const sexoTxt = t("sexo");
    const sexo = sexoDeTexto(sexoTxt);
    if (!sexo) {
      advertencias.push(
        sexoTxt
          ? `${quien}: no se entendió el sexo «${sexoTxt}»; escribe hembra o macho. Se omitió la fila.`
          : `${quien}: falta el sexo (hembra o macho); se omitió la fila.`,
      );
      omitidas++;
      vistas.set(clave, r);
      continue;
    }

    const leida = leerFecha(dato("fechaNacimiento"));
    let fechaNacimiento = leida.fecha;
    if (leida.invalida) advertencias.push(`${quien}: la fecha de nacimiento «${leida.invalida}» no se entendió; usa el formato DD/MM/AAAA.`);
    if (fechaNacimiento && fechaNacimiento > hoy) {
      advertencias.push(`${quien}: la fecha de nacimiento (${fechaNacimiento}) es futura; se dejó vacía.`);
      fechaNacimiento = null;
    }

    const pesoTxt = t("peso");
    let pesoKg = leerNumero(dato("peso"));
    if (pesoTxt && pesoKg == null) {
      advertencias.push(`${quien}: el peso «${pesoTxt}» no es un número; se dejó vacío.`);
    } else if (pesoKg != null && (pesoKg <= 0 || pesoKg > PESO_MAXIMO)) {
      advertencias.push(`${quien}: el peso ${pesoTxt} kg está fuera del rango (1 a ${PESO_MAXIMO} kg); se dejó vacío.`);
      pesoKg = null;
    }
    if (pesoKg != null) pesoKg = Math.round(pesoKg * 100) / 100;

    let categoria = categoriaDerivada(especie, sexo, fechaNacimiento, hoy);
    if (especie === "bovino" && !fechaNacimiento && !leida.invalida)
      advertencias.push(`${quien}: sin fecha de nacimiento no se puede calcular la etapa; quedó como ${categoria}.`);

    // ── Historial mínimo (columnas opcionales) ────────────────────────────────────────────────
    // Solo tiene sentido en hembras bovinas adultas: un macho no se ordeña y una ternera todavía no.
    const hembraBovina = especie === "bovino" && sexo === "hembra";
    let puedeOrdenarse = hembraBovina && categoria !== "ternera";

    const partoLeido = leerFecha(dato("ultimoParto"));
    let ultimoParto = partoLeido.fecha;
    if (partoLeido.invalida)
      advertencias.push(`${quien}: la fecha del último parto «${partoLeido.invalida}» no se entendió; usa el formato DD/MM/AAAA.`);
    if (ultimoParto && ultimoParto > hoy) {
      advertencias.push(`${quien}: la fecha del último parto (${ultimoParto}) es futura; no se registrará el parto.`);
      ultimoParto = null;
    }
    if (ultimoParto && fechaNacimiento && ultimoParto < fechaNacimiento) {
      advertencias.push(
        `${quien}: el último parto (${ultimoParto}) es anterior a la fecha de nacimiento (${fechaNacimiento}); no se registrará el parto.`,
      );
      ultimoParto = null;
    }
    if (ultimoParto && !hembraBovina) {
      advertencias.push(`${quien}: solo una hembra bovina puede tener partos (esta es ${ETIQUETA_ESPECIE[especie]}, ${sexo}); no se registrará el parto.`);
      ultimoParto = null;
    }

    // Si trae parto, es vaca aunque la edad diga otra cosa (misma regla que la base de datos).
    if (ultimoParto && hembraBovina && categoria !== "vaca") {
      categoria = "vaca";
      puedeOrdenarse = true;
    }

    // ── FECHA SERVIDA: el segundo dato que sí se captura del bloque de vacas productivas ──
    const servidaLeida = leerFecha(dato("fechaServida"));
    let fechaServida = servidaLeida.fecha;
    if (servidaLeida.invalida)
      advertencias.push(`${quien}: la fecha servida «${servidaLeida.invalida}» no se entendió; usa el formato DD/MM/AAAA.`);
    if (fechaServida && fechaServida > hoy) {
      advertencias.push(`${quien}: la fecha servida (${fechaServida}) es futura; no se registrará el servicio.`);
      fechaServida = null;
    }
    if (fechaServida && fechaNacimiento && fechaServida < fechaNacimiento) {
      advertencias.push(
        `${quien}: la fecha servida (${fechaServida}) es anterior a la fecha de nacimiento (${fechaNacimiento}); no se registrará el servicio.`,
      );
      fechaServida = null;
    }
    if (fechaServida && !hembraBovina) {
      advertencias.push(
        `${quien}: solo una hembra bovina puede tener servicios (esta es ${ETIQUETA_ESPECIE[especie]}, ${sexo}); no se registrará el servicio.`,
      );
      fechaServida = null;
    }
    if (fechaServida && hembraBovina && categoria === "ternera") {
      advertencias.push(`${quien}: por su edad es una ternera y todavía no se sirve; no se registrará el servicio.`);
      fechaServida = null;
    }
    // El estado reproductivo solo mira los servicios posteriores al último parto: uno anterior se
    // guarda como antecedente, pero no mueve la mora de preñez ni las fechas que calcula el sistema.
    if (fechaServida && ultimoParto && fechaServida <= ultimoParto)
      advertencias.push(
        `${quien}: la fecha servida (${fechaServida}) no es posterior al último parto (${ultimoParto}); el servicio se guarda como antecedente, pero el sistema no lo tomará para la preñez de esta lactancia.`,
      );

    const enOrdenoTxt = t("enOrdeno");
    let enOrdeno = siNoDeTexto(enOrdenoTxt);
    if (enOrdenoTxt && enOrdeno == null)
      advertencias.push(`${quien}: no se entendió «${enOrdenoTxt}» en la columna EN ORDEÑO; escribe sí o no.`);
    if (enOrdeno != null && !hembraBovina) {
      advertencias.push(
        sexo === "macho"
          ? `${quien}: un macho no se ordeña; se ignoró la columna EN ORDEÑO.`
          : `${quien}: la columna EN ORDEÑO solo aplica a hembras bovinas (esta es ${ETIQUETA_ESPECIE[especie]}); se ignoró.`,
      );
      enOrdeno = null;
    } else if (enOrdeno != null && !puedeOrdenarse) {
      advertencias.push(`${quien}: por su edad es una ternera y todavía no se ordeña; se ignoró la columna EN ORDEÑO.`);
      enOrdeno = null;
    }

    const litrosTxt = t("litrosOrdeno");
    let litrosOrdeno = leerNumero(dato("litrosOrdeno"));
    if (litrosTxt && litrosOrdeno == null) {
      advertencias.push(`${quien}: los litros del último ordeño «${litrosTxt}» no son un número; se dejaron vacíos.`);
    } else if (litrosOrdeno != null && (litrosOrdeno < 0 || litrosOrdeno > LITROS_MAXIMO)) {
      advertencias.push(`${quien}: los litros del último ordeño (${litrosTxt}) están fuera del rango (0 a ${LITROS_MAXIMO} litros); se dejaron vacíos.`);
      litrosOrdeno = null;
    }
    if (litrosOrdeno != null) litrosOrdeno = Math.round(litrosOrdeno * 100) / 100;
    if (litrosOrdeno != null && !puedeOrdenarse) {
      advertencias.push(
        `${quien}: no se le puede registrar un ordeño (${ETIQUETA_ESPECIE[especie]}, ${sexo}${categoria === "ternera" ? ", ternera" : ""}); se ignoraron los litros.`,
      );
      litrosOrdeno = null;
    }
    if (litrosOrdeno != null && enOrdeno === false) {
      advertencias.push(`${quien}: dice que NO está en ordeño pero trae litros del último ordeño; manda el «no» y se ignoraron los litros.`);
      litrosOrdeno = null;
    }

    // «Sí» sin litros no crea un ordeño de 0 litros: ese 0 movería la fecha de corte de la finca y
    // bajaría el promedio por vaca. Queda en ordeño por el parto y se pide el dato en la vista previa.
    if (enOrdeno === true && litrosOrdeno == null)
      advertencias.push(
        `${quien}: dice que está en ordeño pero no trae LITROS ÚLTIMO ORDEÑO; no se creará ningún ordeño (uno de 0 litros ensuciaría los informes). Escribe los litros del último ordeño.`,
      );
    if (enOrdeno === true && !ultimoParto)
      advertencias.push(
        `${quien}: dice que está en ordeño pero no trae FECHA ÚLTIMO PARTO; sin esa fecha el sistema no puede calcular sus días en ordeño ni su mora de preñez.`,
      );
    if (enOrdeno === false && !ultimoParto)
      advertencias.push(`${quien}: dice que está seca pero no trae FECHA ÚLTIMO PARTO; sin esa fecha no se puede registrar su secado.`);

    const madreTxt = t("madre");
    const madreChapeta = t("chapetaMadre");
    filas.push({
      fila: r,
      numero,
      nombre,
      chapeta,
      especie,
      sexo,
      categoria,
      raza: normalizarRaza(t("raza")),
      color: t("color") ? titulo(t("color")!) : null,
      fechaNacimiento,
      pesoKg,
      padreNombre: t("padre") ? titulo(t("padre")!) : null,
      padreChapeta: t("chapetaPadre"),
      madreNombre: madreTxt ? titulo(madreTxt) : null,
      madreChapeta: madreChapeta ? madreChapeta.replace(/\.0+$/, "") : null,
      ultimoParto,
      fechaServida,
      enOrdeno,
      litrosOrdeno,
      clave,
    });
    vistas.set(clave, r);
  }

  // Lo que el ganadero escribió en las cuatro columnas calculadas no se guarda: se avisa una vez.
  if (calculadasConDatos.size)
    advertencias.push(
      `${[...calculadasConDatos].join(", ")}: ${calculadasConDatos.size === 1 ? "esa columna la calcula" : "esas columnas las calcula"} el sistema a partir de ${COLUMNAS_PRODUCTIVAS[0]} y ${COLUMNAS_PRODUCTIVAS[3]}; lo que escribiste ahí no se guarda. En la vista previa puedes comprobar que los números cuadran.`,
    );

  // Sin historial el sistema queda adivinando: no hay días en ordeño, ni mora de preñez, ni secado.
  const conHistorial = (["ultimoParto", "fechaServida", "enOrdeno", "litrosOrdeno"] as Campo[]).some((c) => columnas!.has(c));
  const adultasSinParto = filas.filter((f) => f.especie === "bovino" && f.sexo === "hembra" && f.categoria !== "ternera" && !f.ultimoParto).length;
  if (!conHistorial && adultasSinParto) {
    advertencias.push(
      `La planilla no trae las columnas de historial (${COLUMNAS_HISTORIAL.join(", ")}): ${adultasSinParto} ${adultasSinParto === 1 ? "hembra entrará" : "hembras entrarán"} sin antecedentes y el sistema no podrá calcular días en ordeño, mora de preñez ni fecha de secado. Descarga la plantilla nueva para llenarlas.`,
    );
  } else if (conHistorial && adultasSinParto) {
    advertencias.push(
      `${adultasSinParto} ${adultasSinParto === 1 ? "hembra no trae" : "hembras no traen"} FECHA ÚLTIMO PARTO: sin esa fecha el sistema no puede calcular sus días en ordeño, su mora de preñez ni su fecha de secado.`,
    );
  }

  // Sin FECHA SERVIDA no hay de dónde sacar el secado ni el posible nacimiento de la cría.
  const enOrdenoSinServicio = filas.filter((f) => f.ultimoParto && f.enOrdeno !== false && !f.fechaServida).length;
  if (columnas.has("fechaServida") && enOrdenoSinServicio)
    advertencias.push(
      `${enOrdenoSinServicio} ${enOrdenoSinServicio === 1 ? "vaca con parto no trae" : "vacas con parto no traen"} FECHA SERVIDA: sin esa fecha el sistema no puede calcular la fecha posible de secado ni la posible fecha de nacimiento de la cría.`,
    );

  return {
    hoja: ws.name,
    fincaEnArchivo: fincaDeEncabezado(ws, filaEncabezados),
    fecha: hoy,
    conHistorial,
    calculadasConDatos: [...calculadasConDatos],
    filas,
    omitidas,
    advertencias,
  };
}

/** Lee la planilla de seres vivos del libro: la primera hoja que tenga la tabla. */
export async function leerPlanillaSeresVivos(datos: ArrayBuffer | Uint8Array, hoy: string): Promise<PlanSeresVivos | null> {
  const wb = new ExcelJS.Workbook();
  const bytes = datos instanceof Uint8Array ? datos : new Uint8Array(datos);
  await wb.xlsx.load(Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength) as unknown as ExcelJS.Buffer);
  const hojas: ExcelJS.Worksheet[] = [];
  wb.eachSheet((ws) => hojas.push(ws));
  // Gana la primera hoja con filas; si ninguna trae datos se devuelve la primera que sí tenga la tabla
  // (plantilla en blanco) para poder avisar que está vacía en lugar de decir que no se reconoció.
  let vacia: PlanSeresVivos | null = null;
  for (const ws of hojas) {
    const leido = leerHojaSeresVivos(ws, hoy);
    if (!leido) continue;
    if (leido.filas.length || leido.omitidas) return leido;
    vacia ??= leido;
  }
  return vacia;
}
