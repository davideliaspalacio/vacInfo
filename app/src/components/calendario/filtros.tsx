import Link from "next/link";
import clsx from "clsx";
import { TIPOS, VENCIDO } from "./tipos";

function enlace(fincaId: string, mes: string, tipos: string[]) {
  const p = new URLSearchParams({ finca: fincaId, mes });
  if (tipos.length) p.set("tipos", tipos.join(","));
  return `/calendario?${p}`;
}

/** Chips de tipo: sirven de filtro y de leyenda a la vez. */
export function FiltroTipos({ fincaId, mes, activos, conteo }: { fincaId: string; mes: string; activos: string[]; conteo: Record<string, number> }) {
  const todos = activos.length === 0;

  const alternar = (tipo: string) => {
    const nuevos = todos ? [tipo] : activos.includes(tipo) ? activos.filter((t) => t !== tipo) : [...activos, tipo];
    return enlace(fincaId, mes, nuevos.length === Object.keys(TIPOS).length ? [] : nuevos);
  };

  const grupo = (realizado: boolean) => (
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-24 text-xs font-bold uppercase text-tinta-suave">{realizado ? "Realizado" : "Programado"}</span>
      {Object.entries(TIPOS)
        .filter(([, t]) => t.realizado === realizado)
        .map(([clave, t]) => {
          const activo = todos || activos.includes(clave);
          return (
            <Link
              key={clave}
              href={alternar(clave)}
              aria-pressed={activo}
              className={clsx(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold",
                activo ? "border-tinta/20 bg-white text-bosque" : "border-dashed border-tinta/20 text-tinta-suave/70 line-through",
              )}
            >
              <span className={clsx("h-3 w-3 rounded-sm", t.punto)} aria-hidden />
              {t.etiqueta}
              {conteo[clave] ? <span className="tabular-nums text-tinta-suave">{conteo[clave]}</span> : null}
            </Link>
          );
        })}
    </div>
  );

  return (
    <div className="space-y-2">
      {grupo(true)}
      {grupo(false)}
      <div className="flex flex-wrap items-center gap-3 pt-1 text-xs text-tinta-suave">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-5 rounded-sm bg-sky-700" aria-hidden /> Lleno: ya se hizo
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-5 rounded-sm border-2 border-sky-700 bg-white" aria-hidden /> Con borde: programado
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className={clsx("h-3 w-5 rounded-sm border", VENCIDO)} aria-hidden /> Rojo: programado y vencido
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-5 rounded-sm bg-dorado/40 ring-2 ring-dorado" aria-hidden /> Día de corte
        </span>
        {!todos && (
          <Link href={enlace(fincaId, mes, [])} className="ml-auto font-bold text-bosque underline print:hidden">
            Mostrar todos
          </Link>
        )}
      </div>
    </div>
  );
}

export { enlace as enlaceCalendario };
