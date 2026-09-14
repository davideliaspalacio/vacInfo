import Link from "next/link";
import clsx from "clsx";
import { CalendarRange } from "lucide-react";
import { fecha, hoyISO } from "@/lib/formato";
import { paramsConservados, type Atajo, type Params } from "@/lib/rango";

type Props = {
  /** Ruta de la página (sin querystring). */
  ruta: string;
  searchParams: Params;
  /** Valores de los campos (fecha 'YYYY-MM-DD' o mes 'YYYY-MM'). Vacío = sin límite. */
  desde: string;
  hasta: string;
  /** Rango activo en palabras ("Del 15/04/2026 al 30/04/2026"). */
  texto: React.ReactNode;
  atajos: Atajo[];
  tipo?: "date" | "month";
  /** Fecha hasta la que se cuentan los atajos; si no es hoy se aclara bajo el selector. */
  referencia?: string;
  /** Aclaración adicional bajo el selector. */
  nota?: React.ReactNode;
  /** Parámetros que no se conservan al cambiar el rango, además de desde/hasta/corte/meses y las páginas. */
  omitir?: string[];
  /** Id del elemento al que vuelve la vista después de aplicar un atajo. */
  ancla?: string;
  className?: string;
};

/**
 * Selector de rango "desde / hasta" con atajos. Funciona sin JavaScript: el formulario es GET y los atajos son
 * enlaces; ambos conservan el resto de la URL (pestaña, finca, animal…) y reinician la paginación.
 * La validación (fechas reales, desde ≤ hasta) la hace `lib/rango.ts` en el servidor.
 */
export function RangoFechas({ ruta, searchParams, desde, hasta, texto, atajos, tipo = "date", referencia, nota, omitir = [], ancla, className }: Props) {
  const conservados = paramsConservados(searchParams, omitir);
  const notaReferencia =
    referencia && referencia < hoyISO() ? `Los atajos cuentan hasta el ${fecha(referencia, true)}, la fecha de los últimos datos registrados.` : null;
  const enlace = (a: Atajo) => {
    const q = new URLSearchParams(conservados);
    q.set("desde", a.desde);
    q.set("hasta", a.hasta);
    return `${ruta}?${q}${ancla ? `#${ancla}` : ""}`;
  };

  return (
    <div className={clsx("space-y-3", className)}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <p className="flex items-center gap-2 text-sm text-tinta-suave" aria-live="polite">
          <CalendarRange className="h-4 w-4 shrink-0 text-bosque" aria-hidden />
          <strong className="text-bosque">{texto}</strong>
        </p>
        <form action={ruta} className="flex flex-wrap items-end gap-2">
          {conservados.map(([k, v], i) => (
            <input key={`${k}-${i}`} type="hidden" name={k} value={v} />
          ))}
          <label className="text-xs font-bold uppercase tracking-wide text-bosque">
            Desde
            <input type={tipo} name="desde" defaultValue={desde} max={hasta || undefined} className="campo-control mt-1 w-auto py-2 normal-case" />
          </label>
          <label className="text-xs font-bold uppercase tracking-wide text-bosque">
            Hasta
            <input type={tipo} name="hasta" defaultValue={hasta} className="campo-control mt-1 w-auto py-2 normal-case" />
          </label>
          <button className="rounded-xl bg-bosque px-4 py-2.5 text-sm font-bold text-leche">Ver</button>
        </form>
      </div>
      <nav aria-label="Atajos de rango de fechas" className="flex flex-wrap gap-2 print:hidden">
        {atajos.map((a) => (
          <Link
            key={a.clave}
            href={enlace(a)}
            scroll={ancla ? undefined : false}
            aria-current={a.activo ? "true" : undefined}
            className={clsx(
              "rounded-xl px-3 py-1.5 text-xs font-bold",
              a.activo ? "bg-bosque text-leche" : "border border-tinta/15 bg-white/70 text-tinta-suave hover:bg-lima-suave hover:text-bosque",
            )}
          >
            {a.texto}
          </Link>
        ))}
      </nav>
      {(nota || notaReferencia) && (
        <p className="text-xs text-tinta-suave">
          {nota}
          {nota && notaReferencia && " "}
          {notaReferencia}
        </p>
      )}
    </div>
  );
}
