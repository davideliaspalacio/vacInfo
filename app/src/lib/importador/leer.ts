import ExcelJS from "exceljs";
import type { Cuarto, FilaHoja, HojaLeida, Sexo, TipoSanidad } from "./tipos";
import { fechaDeNombreHoja, fechaValida, normalizarEncabezado, sumarDiasISO, titulo } from "./normalizar";

type Campo =
  | "chapeta"
  | "nombre"
  | "partoAnterior"
  | "crio"
  | "servida"
  | "toro"
  | "raza"
  | "inseminador"
  | "palpada"
  | "prenada"
  | "palpador"
  | "secado"
  | "lavado"
  | "aborto"
  | "tarde"
  | "manana"
  | "criaSexo"
  | Cuarto
  | TipoSanidad;

const CUARTOS: Cuarto[] = ["TDD", "TDI", "TTD", "TTI"];

function campoDeEncabezado(h: string): Campo | null {
  if (h === "CHAPETA") return "chapeta";
  if (h === "NOMBRE") return "nombre";
  if (h.startsWith("FECHA PARTO ANTER")) return "partoAnterior";
  if (h === "FECHA CRIO") return "crio";
  if (h.startsWith("FECHA DE SERVIDA")) return "servida";
  if (h === "NOMBRE DEL TORO") return "toro";
  if (h === "RAZA DEL TORO") return "raza";
  if (h === "INSEMINA") return "inseminador";
  if (h === "PALPADA EL") return "palpada";
  if (h === "PREÑADA" || h === "PRENADA") return "prenada";
  if (h === "PALPA") return "palpador";
  if (h === "FECHA SECADO") return "secado";
  if (h.startsWith("LAVADO")) return "lavado";
  if (h.startsWith("ABORTO")) return "aborto";
  if (h === "TARDE") return "tarde";
  if (h.startsWith("MAÑAN") || h.startsWith("MANAN")) return "manana";
  if (h === "CRIO" || h.startsWith("CRIO ")) return "criaSexo";
  if ((CUARTOS as string[]).includes(h)) return h as Cuarto;
  if (h.startsWith("COJERA")) return "cojera";
  if (h === "FIEBRE LECHE") return "fiebre_leche";
  if (h === "FIEBRE") return "fiebre";
  if (h.startsWith("MASTITIS")) return "mastitis";
  if (h.startsWith("ENTAMBORADA")) return "entamborada";
  return null;
}

const FIN_DE_TABLA = /CONCENTRADOS|ABONOS QUE|ADMINISTRADOR|MAYORDOMO/;
const SANIDAD: TipoSanidad[] = ["mastitis", "cojera", "fiebre", "entamborada", "fiebre_leche"];

/** Valor "plano" de una celda: resultado en caché de fórmulas, texto de rich text, sin errores. */
function valor(celda: ExcelJS.Cell): string | number | Date | boolean | null {
  const v = celda.value as unknown;
  if (v == null) return null;
  if (v instanceof Date || typeof v === "string" || typeof v === "number" || typeof v === "boolean") return v;
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    if ("result" in o) {
      const r = o.result;
      return r instanceof Date || typeof r === "string" || typeof r === "number" || typeof r === "boolean" ? r : null;
    }
    if ("formula" in o || "sharedFormula" in o || "error" in o) return null;
    if (Array.isArray(o.richText)) return (o.richText as { text: string }[]).map((t) => t.text).join("");
    if (typeof o.text === "string") return o.text;
  }
  return null;
}

function texto(v: ReturnType<typeof valor>): string | null {
  if (v == null) return null;
  if (v instanceof Date) return isoDeDate(v);
  const s = String(v).trim();
  return s || null;
}

function isoDeDate(d: Date) {
  if (Number.isNaN(d.getTime())) return null;
  const redondeado = new Date(Math.round(d.getTime() / 86_400_000) * 86_400_000);
  return redondeado.toISOString().slice(0, 10);
}

type Fecha = { fecha: string | null; novilla: boolean; invalida: string | null };

function leerFecha(v: ReturnType<typeof valor>): Fecha {
  if (v == null) return { fecha: null, novilla: false, invalida: null };
  if (v instanceof Date) {
    const iso = isoDeDate(v);
    if (!iso) return { fecha: null, novilla: false, invalida: "fecha inválida" };
    const anio = Number(iso.slice(0, 4));
    return anio >= 1990 && anio <= 2100 ? { fecha: iso, novilla: false, invalida: null } : { fecha: null, novilla: false, invalida: iso };
  }
  if (typeof v === "number") {
    // Número de serie de Excel en una celda sin formato de fecha
    if (v > 30000 && v < 80000) return { fecha: sumarDiasISO("1899-12-30", Math.floor(v)), novilla: false, invalida: null };
    return { fecha: null, novilla: false, invalida: String(v) };
  }
  const s = String(v).trim();
  if (!s) return { fecha: null, novilla: false, invalida: null };
  if (/^NOVILL/i.test(s)) return { fecha: null, novilla: true, invalida: null };
  const m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/.exec(s);
  if (m) {
    const anio = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
    const f = fechaValida(anio, Number(m[2]), Number(m[1]));
    if (f) return { fecha: f, novilla: false, invalida: null };
  }
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (iso) {
    const f = fechaValida(Number(iso[1]), Number(iso[2]), Number(iso[3]));
    if (f) return { fecha: f, novilla: false, invalida: null };
  }
  return { fecha: null, novilla: false, invalida: s };
}

function leerNumero(v: ReturnType<typeof valor>): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string") {
    const n = Number(v.trim().replace(",", "."));
    return v.trim() && Number.isFinite(n) ? n : null;
  }
  return null;
}

const marcado = (v: string | null) => !!v && !/^(NO|N|0)$/i.test(v);

/** Busca la fecha de corte en las primeras filas (celda con fecha junto a los títulos). */
function fechaCorteDe(ws: ExcelJS.Worksheet): string | null {
  for (let r = 1; r <= 2; r++) {
    let encontrada: string | null = null;
    ws.getRow(r).eachCell((celda) => {
      const v = valor(celda);
      if (!encontrada && v instanceof Date) encontrada = isoDeDate(v);
    });
    if (encontrada) return encontrada;
  }
  return null;
}

export function esHojaQuincenal(nombre: string) {
  return fechaDeNombreHoja(nombre) != null;
}

function leerHoja(ws: ExcelJS.Worksheet): HojaLeida | null {
  const advertencias: string[] = [];
  const porNombre = fechaDeNombreHoja(ws.name);
  const enCelda = fechaCorteDe(ws);
  const fechaCorte = enCelda ?? porNombre;
  if (!fechaCorte) return null;
  if (enCelda && porNombre && enCelda !== porNombre) {
    advertencias.push(`La fecha de corte de la hoja (${enCelda}) no coincide con su nombre (${porNombre}); se usa la de la hoja.`);
  }

  const filas: FilaHoja[] = [];
  let columnas: Map<Campo, number[]> | null = null;
  let bloque = 0;

  for (let r = 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const encabezados: [number, string][] = [];
    row.eachCell((celda, c) => {
      const t = texto(valor(celda));
      if (t) encabezados.push([c, normalizarEncabezado(t)]);
    });
    if (encabezados.some(([, h]) => h === "CHAPETA")) {
      columnas = new Map();
      for (const [c, h] of encabezados) {
        const campo = campoDeEncabezado(h);
        if (!campo) continue;
        columnas.set(campo, [...(columnas.get(campo) ?? []), c]);
      }
      bloque++;
      continue;
    }
    if (!columnas) continue;

    const col = columnas;
    const celda = (campo: Campo, i = 0) => {
      const c = col.get(campo)?.[i];
      return c ? valor(row.getCell(c)) : null;
    };
    const t = (campo: Campo) => texto(celda(campo));

    const chapetaTxt = t("chapeta");
    const nombreTxt = t("nombre");
    if ((chapetaTxt && FIN_DE_TABLA.test(chapetaTxt.toUpperCase())) || (nombreTxt && FIN_DE_TABLA.test(nombreTxt.toUpperCase()))) {
      columnas = null;
      break;
    }
    if (!chapetaTxt && !nombreTxt) continue;
    if (!nombreTxt) {
      advertencias.push(`Fila ${r}: chapeta ${chapetaTxt} sin nombre; se omitió.`);
      continue;
    }
    const nombre = titulo(nombreTxt);
    const chapeta = chapetaTxt ? chapetaTxt.replace(/\.0+$/, "") : null;
    const quien = `${nombre}${chapeta ? ` (${chapeta})` : ""}`;

    const fecha = (campo: Campo, i = 0, etiqueta = campo as string) => {
      const f = leerFecha(celda(campo, i));
      if (f.invalida) advertencias.push(`${quien}: fecha no reconocida en ${etiqueta} («${f.invalida}»).`);
      return f;
    };

    let novilla = false;
    const partosAnteriores: string[] = [];
    (col.get("partoAnterior") ?? []).forEach((_, i) => {
      const f = fecha("partoAnterior", i, "FECHA PARTO ANTERIOR");
      if (f.novilla) novilla = true;
      if (f.fecha) partosAnteriores.push(f.fecha);
    });
    const crio = fecha("crio", 0, "FECHA CRIO");
    if (crio.novilla) novilla = true;

    const servida = fecha("servida", 0, "FECHA DE SERVIDA");
    const palpada = fecha("palpada", 0, "PALPADA EL");
    const secado = fecha("secado", 0, "FECHA SECADO");

    const abortoTxt = t("aborto");
    const lavadoTxt = t("lavado");
    const criaTxt = celda("criaSexo");
    let criaSexo: Sexo | null = null;
    let fechaEnCrio: string | null = null;
    let aborto = !!abortoTxt && /^(SI|S|X+)$/i.test(abortoTxt);
    if (criaTxt instanceof Date) {
      fechaEnCrio = isoDeDate(criaTxt);
      if (!fechaEnCrio) advertencias.push(`${quien}: fecha inválida en CRIO.`);
    } else if (typeof criaTxt === "string") {
      const s = criaTxt.trim().toUpperCase();
      if (s.startsWith("HEMBRA")) criaSexo = "hembra";
      else if (s.startsWith("MACHO")) criaSexo = "macho";
      else if (s.startsWith("ABORT")) aborto = true;
      else if (s) advertencias.push(`${quien}: valor no reconocido en CRIO («${criaTxt.trim()}»).`);
    }
    if (abortoTxt && !aborto) advertencias.push(`${quien}: marca «${abortoTxt}» en ABORTO no reconocida; se ignoró.`);

    const tipos = SANIDAD.filter((s) => marcado(t(s)));
    const cuartos = CUARTOS.filter((c) => marcado(t(c)));
    if (cuartos.length && !tipos.includes("mastitis")) tipos.unshift("mastitis");

    filas.push({
      fila: r,
      bloque: bloque >= 2 ? 2 : 1,
      chapeta,
      nombre,
      partosAnteriores,
      fechaCrio: crio.fecha,
      novilla,
      servicio: servida.fecha
        ? { fecha: servida.fecha, toro: t("toro"), raza: t("raza"), inseminador: t("inseminador") }
        : null,
      palpacion: palpada.fecha
        ? { fecha: palpada.fecha, prenada: /^SI/i.test(t("prenada") ?? ""), palpador: t("palpador") }
        : null,
      secado: secado.fecha,
      aborto,
      lavado: !!lavadoTxt && /^SI$/i.test(lavadoTxt),
      mellizos: !!lavadoTxt && /MELLIZ/i.test(lavadoTxt),
      leche: { tarde: leerNumero(celda("tarde")), manana: leerNumero(celda("manana")) },
      sanidad: { tipos, cuartos },
      criaSexo,
      fechaEnCrio,
    });
  }

  const vistos = new Map<string, number>();
  for (const f of filas) {
    const k = `${f.chapeta ?? ""}|${f.nombre.toUpperCase()}`;
    if (vistos.has(k)) advertencias.push(`${f.nombre} (${f.chapeta ?? "sin chapeta"}) aparece dos veces (filas ${vistos.get(k)} y ${f.fila}).`);
    else vistos.set(k, f.fila);
  }

  return { nombre: ws.name, fechaCorte, filas, advertencias };
}

export interface LibroLeido {
  hojas: HojaLeida[];
  ignoradas: string[];
}

/** Lee todas las planillas quincenales del libro. Las hojas que no tienen nombre de fecha se ignoran. */
export async function leerLibro(datos: ArrayBuffer | Uint8Array): Promise<LibroLeido> {
  const wb = new ExcelJS.Workbook();
  const bytes = datos instanceof Uint8Array ? datos : new Uint8Array(datos);
  await wb.xlsx.load(Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength) as unknown as ExcelJS.Buffer);
  const hojas: HojaLeida[] = [];
  const ignoradas: string[] = [];
  wb.eachSheet((ws) => {
    const hoja = esHojaQuincenal(ws.name) ? leerHoja(ws) : null;
    if (hoja && hoja.filas.length) hojas.push(hoja);
    else ignoradas.push(ws.name);
  });
  return { hojas, ignoradas };
}
