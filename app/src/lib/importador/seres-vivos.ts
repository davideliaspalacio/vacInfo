/**
 * Lectura de la «PLANILLA IMPLEMENTACIÓN SERES VIVOS»: el listado en papel con el que el cliente
 * da de alta todos los animales de una finca de una sola vez.
 *
 * Columnas de la planilla: #, ESPECIE, RAZA, COLOR, SEXO, NOMBRE, FECHA NACIMIENTO, CHAPETA, PESO,
 * PADRE, CHAPETA PADRE, MADRE, CHAPETA MADRE.
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

/** Encabezados exactos de la planilla del cliente, en orden. */
export const COLUMNAS_PLANILLA = [
  "#",
  "ESPECIE",
  "RAZA",
  "COLOR",
  "SEXO",
  "NOMBRE",
  "FECHA NACIMIENTO",
  "CHAPETA",
  "PESO",
  "PADRE",
  "CHAPETA PADRE",
  "MADRE",
  "CHAPETA MADRE",
] as const;

/** Nombres de especie que se ofrecen en la plantilla (la lectura acepta más variantes). */
export const ESPECIES_ACEPTADAS = ["Bovino", "Equino", "Canino", "Ave", "Otro"] as const;

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
  | "chapetaMadre";

/**
 * Campo al que corresponde un encabezado. El orden importa: «CHAPETA PADRE» y «NOMBRE DE LA MADRE»
 * se resuelven antes que «CHAPETA» y «NOMBRE».
 */
export function campoDeEncabezado(encabezado: string): Campo | null {
  const h = normalizarEncabezado(encabezado)
    .replace(/[.:]+$/, "")
    .trim();
  if (!h) return null;
  if (/^(#|N|N°|NO|NRO|NUM|NUMERO|ITEM|ORDEN)$/.test(h)) return "numero";
  if (/^ESPECIE/.test(h)) return "especie";
  if (/^SEXO/.test(h)) return "sexo";
  if (/^COLOR/.test(h)) return "color";
  if (/^PESO/.test(h)) return "peso";
  if (/^(FECHA (DE )?NACIMIENTO|FECHA NAC|NACIMIENTO|NACIO)/.test(h)) return "fechaNacimiento";
  if (/PADRE/.test(h)) return /CHAPETA/.test(h) ? "chapetaPadre" : /^(NOMBRE (DEL )?)?PADRE$/.test(h) ? "padre" : null;
  if (/MADRE/.test(h)) return /CHAPETA/.test(h) ? "chapetaMadre" : /^(NOMBRE (DE LA )?)?MADRE$/.test(h) ? "madre" : null;
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

/** Meses completos entre dos fechas ISO. */
export function mesesEntre(desde: string, hasta: string) {
  const [a1, m1, d1] = desde.split("-").map(Number);
  const [a2, m2, d2] = hasta.split("-").map(Number);
  return (a2 - a1) * 12 + (m2 - m1) - (d2 < d1 ? 1 : 0);
}

/**
 * Categoría según especie, sexo y edad al momento de importar:
 * bovino hembra < 12 meses ternera y ≥ 12 novilla; bovino macho < 12 ternero, 12–24 novillo y > 24 toro.
 * Sin fecha de nacimiento la hembra queda vaca y el macho toro. Caballo, perro y cualquier otra especie
 * van a su propia categoría.
 */
export function categoriaDerivada(especie: Especie, sexo: Sexo, fechaNacimiento: string | null, hoy: string): Categoria {
  if (especie === "equino") return "caballo";
  if (especie === "canino") return "perro";
  if (especie !== "bovino") return "otro";
  if (!fechaNacimiento) return sexo === "hembra" ? "vaca" : "toro";
  const meses = Math.max(0, mesesEntre(fechaNacimiento, hoy));
  if (sexo === "hembra") return meses < 12 ? "ternera" : "novilla";
  if (meses < 12) return "ternero";
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
  /** Clave de deduplicación: chapeta normalizada si hay, si no el nombre normalizado. */
  clave: string;
}

export interface PlanSeresVivos {
  hoja: string;
  /** Texto escrito junto a «PERTENECEN A FINCA:», si venía. */
  fincaEnArchivo: string | null;
  /** Fecha con la que se calculan las categorías y se registran los pesajes. */
  fecha: string;
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

    const categoria = categoriaDerivada(especie, sexo, fechaNacimiento, hoy);
    if (especie === "bovino" && !fechaNacimiento && !leida.invalida)
      advertencias.push(`${quien}: sin fecha de nacimiento no se puede calcular la etapa; quedó como ${categoria}.`);

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
      clave,
    });
    vistas.set(clave, r);
  }

  return {
    hoja: ws.name,
    fincaEnArchivo: fincaDeEncabezado(ws, filaEncabezados),
    fecha: hoy,
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
