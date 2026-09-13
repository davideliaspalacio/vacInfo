"use client";

import { useActionState } from "react";
import clsx from "clsx";
import { CircleCheck, TriangleAlert } from "lucide-react";

export type EstadoAccion = { ok?: string; error?: string };

/** Formulario corto de VacInfo que llama una acción de servidor y muestra el resultado debajo del botón. */
export function FormularioAccion({
  accion,
  boton,
  className,
  botonClassName,
  children,
}: {
  accion: (estado: EstadoAccion, datos: FormData) => Promise<EstadoAccion>;
  boton: string;
  className?: string;
  botonClassName?: string;
  children: React.ReactNode;
}) {
  const [estado, enviar, pendiente] = useActionState(accion, {});

  return (
    <form action={enviar} className={className ?? "space-y-3"}>
      {children}
      <div className="flex flex-wrap items-center gap-3">
        <button
          disabled={pendiente}
          className={clsx("boton-accion inline-flex items-center justify-center rounded-xl bg-bosque px-4 py-2.5 text-sm font-bold text-leche disabled:opacity-60", botonClassName)}
        >
          {pendiente ? "Guardando…" : boton}
        </button>
        {!pendiente && estado.ok && (
          <span role="status" className="inline-flex items-center gap-1 text-sm font-bold text-pasto-oscuro">
            <CircleCheck className="h-4 w-4" aria-hidden />
            {estado.ok}
          </span>
        )}
        {!pendiente && estado.error && (
          <span role="alert" className="inline-flex items-center gap-1 text-sm font-bold text-alerta">
            <TriangleAlert className="h-4 w-4" aria-hidden />
            {estado.error}
          </span>
        )}
      </div>
    </form>
  );
}
