"use client";

import { Printer } from "lucide-react";

export function BotonImprimir() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="boton-accion inline-flex items-center gap-2 rounded-xl bg-dorado px-4 py-3 font-bold text-bosque print:hidden"
    >
      <Printer className="h-4 w-4" aria-hidden />
      Imprimir
    </button>
  );
}
