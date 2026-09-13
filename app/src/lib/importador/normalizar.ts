const RAZAS: Record<string, string> = {
  JERSY: "Jersey",
  JERSEY: "Jersey",
  HOSTEIN: "Holstein",
  HOLSTEIN: "Holstein",
  GUIR: "Gyr",
  GYR: "Gyr",
  PARDO: "Pardo Suizo",
};

const INSEMINADORES: Record<string, string> = { NL: "Nelson", NEL: "Nelson", CH: "Chepo", GT: "Gustavo" };
const PALPADORES: Record<string, string> = { CG: "C.G. (veterinario)" };

export function sinTildes(v: string) {
  return v.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/** Texto de encabezado comparable: mayúsculas, sin tildes (salvo la Ñ) y espacios simples. */
export function normalizarEncabezado(v: string) {
  return sinTildes(v.toUpperCase().replace(/Ñ/g, "\u0000"))
    .replace(/\u0000/g, "Ñ")
    .replace(/\s+/g, " ")
    .trim();
}

export function titulo(v: string) {
  return v
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase()
    .replace(/(^|[\s\-(])(\p{L})/gu, (_, sep: string, letra: string) => sep + letra.toUpperCase());
}

export function normalizarChapeta(v: string | null | undefined) {
  if (v == null) return "";
  return String(v).trim().replace(/\.0+$/, "").replace(/\s+/g, "").toUpperCase();
}

export function normalizarNombre(v: string | null | undefined) {
  return sinTildes(String(v ?? "").toUpperCase())
    .replace(/[^A-Z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export const claveAnimal = (chapeta: string | null | undefined, nombre: string | null | undefined) =>
  `${normalizarChapeta(chapeta)}|${normalizarNombre(nombre)}`;

export function normalizarRaza(v: string | null) {
  if (!v) return null;
  const limpio = v.trim().replace(/\s+/g, " ");
  return RAZAS[limpio.toUpperCase()] ?? limpio;
}

export const normalizarToro = (v: string | null) => (v ? titulo(v) : null);

export function normalizarInseminador(v: string | null) {
  if (!v) return null;
  const k = v.trim().toUpperCase();
  return INSEMINADORES[k] ?? v.trim();
}

export function normalizarPalpador(v: string | null) {
  if (!v) return null;
  const k = v.trim().toUpperCase();
  return PALPADORES[k] ?? v.trim();
}

/** Nombre de hoja `DDMYY` o `DDMMYY` → fecha ISO. */
export function fechaDeNombreHoja(nombre: string): string | null {
  const m = /^(\d{1,2})(\d{1,2})(\d{2})$/.exec(nombre.trim());
  if (!m) return null;
  let dia: number, mes: number;
  const s = nombre.trim();
  if (s.length === 5) {
    dia = Number(s.slice(0, 2));
    mes = Number(s.slice(2, 3));
  } else if (s.length === 6) {
    dia = Number(s.slice(0, 2));
    mes = Number(s.slice(2, 4));
  } else {
    return null;
  }
  const anio = 2000 + Number(m[3]);
  return fechaValida(anio, mes, dia);
}

export function fechaValida(anio: number, mes: number, dia: number) {
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return null;
  const d = new Date(Date.UTC(anio, mes - 1, dia));
  if (d.getUTCMonth() !== mes - 1) return null;
  return d.toISOString().slice(0, 10);
}

export function diasEntre(desde: string, hasta: string) {
  return Math.round((Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / 86_400_000);
}

export function sumarDiasISO(iso: string, dias: number) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}
