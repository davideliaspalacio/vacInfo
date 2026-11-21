"use client";

import clsx from "clsx";
import Link from "next/link";
import { CloudUpload, TriangleAlert } from "lucide-react";
import { usePendientes } from "./hooks";

/**
 * Aviso de lo que falta por enviar en el encabezado de todas las pantallas de VacDaTa. Lleva a la
 * barra de estado de «Registrar», que es donde se ve el detalle desde que se quitó la pestaña
 * «Pendientes». En rojo si algo falló: eso no se puede esconder.
 */
export function InsigniaPendientes() {
  const { total, errores } = usePendientes();
  if (!total) return null;
  return (
    <Link
      href="/campo/registrar#estado"
      title={errores > 0 ? "Registros que no se pudieron enviar" : "Registros guardados en el teléfono que aún no se envían"}
      className={clsx(
        "inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-xs font-bold",
        errores > 0 ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-900",
      )}
    >
      {errores > 0 ? <TriangleAlert className="h-4 w-4" aria-hidden /> : <CloudUpload className="h-4 w-4" aria-hidden />}
      {errores > 0 ? `${errores} con error` : `${total} sin enviar`}
    </Link>
  );
}
