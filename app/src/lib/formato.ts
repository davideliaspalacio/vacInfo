const cop = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
const numero = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 1 });
const porcentaje = new Intl.NumberFormat("es-CO", { style: "percent", minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const pesos = (v: number | null | undefined) => (v == null ? "—" : cop.format(v));
export const num = (v: number | null | undefined) => (v == null ? "—" : numero.format(v));
export const pct = (v: number | null | undefined) => (v == null ? "—" : porcentaje.format(v));
export const litros = (v: number | null | undefined) => (v == null ? "—" : `${numero.format(v)} L`);

/** 'YYYY-MM-DD' → '30/04/26' sin corrimientos de zona horaria. */
export function fecha(v: string | null | undefined, largo = false) {
  if (!v) return "—";
  const [y, m, d] = v.slice(0, 10).split("-");
  return largo ? `${d}/${m}/${y}` : `${d}/${m}/${y.slice(2)}`;
}

export function hoyISO() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

export function sumarDias(iso: string, dias: number) {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
}
