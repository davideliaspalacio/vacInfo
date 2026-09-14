import Link from "next/link";
import clsx from "clsx";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { num } from "@/lib/formato";
import { hrefPagina, totalPaginas, type Params } from "@/lib/paginacion";

type Props = {
  ruta: string;
  searchParams: Params;
  /** Parámetro de la URL que guarda la página de esta lista. */
  param?: string;
  pagina: number;
  tamano: number;
  total: number;
  /** Id del elemento al que vuelve la vista al cambiar de página. Sin ancla se conserva el scroll. */
  ancla?: string;
  /** Nombre de lo que se lista, en plural ("registros", "fincas"). */
  unidad?: string;
  etiqueta?: string;
  /** "fondo" para usarla directamente sobre el fondo verde de VacInfo. */
  tono?: "papel" | "fondo";
  className?: string;
};

export function Paginacion({
  ruta,
  searchParams,
  param = "pagina",
  pagina,
  tamano,
  total,
  ancla,
  unidad = "registros",
  etiqueta = "Paginación",
  tono = "papel",
  className,
}: Props) {
  const paginas = totalPaginas(total, tamano);
  if (paginas <= 1) return null;

  const primero = (pagina - 1) * tamano + 1;
  const ultimo = Math.min(pagina * tamano, total);
  const boton = clsx(
    "inline-flex items-center gap-1 rounded-xl border px-3 py-2 font-bold",
    tono === "fondo" ? "border-white/30 bg-[rgba(8,26,16,0.42)] text-leche" : "border-bosque/20 bg-white text-bosque",
  );
  const activo = tono === "fondo" ? "hover:bg-[rgba(8,26,16,0.7)]" : "hover:bg-lima-suave";
  const inactivo = "cursor-not-allowed opacity-40";

  const enlace = (n: number, rel: "prev" | "next", hijos: React.ReactNode) =>
    n < 1 || n > paginas ? (
      <span aria-disabled="true" className={clsx(boton, inactivo)}>
        {hijos}
      </span>
    ) : (
      <Link href={hrefPagina(ruta, searchParams, param, n, ancla)} rel={rel} scroll={ancla ? undefined : false} className={clsx(boton, activo)}>
        {hijos}
      </Link>
    );

  return (
    <nav aria-label={etiqueta} className={clsx("mt-4 flex flex-wrap items-center justify-between gap-3 text-sm print:hidden", className)}>
      <p className={tono === "fondo" ? "text-leche/80" : "text-tinta-suave"}>
        {num(primero)}–{num(ultimo)} de <strong className={tono === "fondo" ? "text-leche" : "text-bosque"}>{num(total)}</strong> {unidad}
      </p>
      <div className="flex items-center gap-2">
        {enlace(
          pagina - 1,
          "prev",
          <>
            <ChevronLeft className="h-4 w-4" aria-hidden />
            Anterior
          </>,
        )}
        <span aria-current="page" className={clsx("px-2 font-bold tabular-nums", tono === "fondo" ? "text-leche" : "text-bosque")}>
          Página {num(pagina)} de {num(paginas)}
        </span>
        {enlace(
          pagina + 1,
          "next",
          <>
            Siguiente
            <ChevronRight className="h-4 w-4" aria-hidden />
          </>,
        )}
      </div>
    </nav>
  );
}
