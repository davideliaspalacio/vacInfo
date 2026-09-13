export type Formato = "litros" | "numero" | "pct" | "pesos" | "dias";

const decimal = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 1 });
const cop = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });

export function formatear(v: number | null | undefined, formato: Formato) {
  if (v == null || !Number.isFinite(v)) return "—";
  switch (formato) {
    case "litros":
      return `${decimal.format(v)} L`;
    case "pct":
      return `${decimal.format(v * 100)} %`;
    case "pesos":
      return cop.format(v);
    case "dias":
      return `${decimal.format(v)} días`;
    default:
      return decimal.format(v);
  }
}
