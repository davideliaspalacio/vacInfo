import type ExcelJS from "exceljs";
import { fechaValida, sumarDiasISO } from "./normalizar";

export type ValorCelda = string | number | Date | boolean | null;

/** Valor "plano" de una celda: resultado en caché de fórmulas, texto de rich text, sin errores. */
export function valor(celda: ExcelJS.Cell): ValorCelda {
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

export function isoDeDate(d: Date) {
  if (Number.isNaN(d.getTime())) return null;
  const redondeado = new Date(Math.round(d.getTime() / 86_400_000) * 86_400_000);
  return redondeado.toISOString().slice(0, 10);
}

export function texto(v: ValorCelda): string | null {
  if (v == null) return null;
  if (v instanceof Date) return isoDeDate(v);
  const s = String(v).trim();
  return s || null;
}

export type Fecha = { fecha: string | null; novilla: boolean; invalida: string | null };

/** Fecha de una celda: Date, número de serie de Excel, `DD/MM/AAAA` o ISO. `novilla` es de la planilla quincenal. */
export function leerFecha(v: ValorCelda): Fecha {
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

export function leerNumero(v: ValorCelda): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string") {
    const n = Number(v.trim().replace(",", "."));
    return v.trim() && Number.isFinite(n) ? n : null;
  }
  return null;
}
