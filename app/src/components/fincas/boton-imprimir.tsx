"use client";

import { Printer } from "lucide-react";

const ESTILO_IMPRESION = `@media print {
  body * { visibility: hidden !important; }
  #chapeta-imprimible, #chapeta-imprimible * { visibility: visible !important; }
  #chapeta-imprimible { position: fixed; left: 0; top: 0; width: 6cm; max-width: none; }
}`;

export function BotonImprimir() {
  return (
    <>
      <style>{ESTILO_IMPRESION}</style>
      <button
        type="button"
        onClick={() => window.print()}
        className="boton-accion inline-flex items-center gap-2 rounded-xl bg-lima px-4 py-2 text-sm font-bold text-bosque"
      >
        <Printer className="h-4 w-4" aria-hidden />
        Imprimir chapeta
      </button>
    </>
  );
}
