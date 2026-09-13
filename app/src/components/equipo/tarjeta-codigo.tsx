"use client";

import { useRef, useState } from "react";
import { Check, Copy, Printer } from "lucide-react";

const ESTILO_IMPRESION = `@media print {
  html.imprimir-invitacion body * { visibility: hidden !important; }
  html.imprimir-invitacion [data-imprimir="si"], html.imprimir-invitacion [data-imprimir="si"] * { visibility: visible !important; }
  html.imprimir-invitacion [data-imprimir="si"] { position: fixed; left: 0; top: 0; width: 12cm; border: 0; }
}`;

export function TarjetaCodigo({ codigo, enlace, svg, detalle }: { codigo: string; enlace: string; svg: string; detalle?: string }) {
  const tarjeta = useRef<HTMLDivElement>(null);
  const [copiado, setCopiado] = useState<"enlace" | "codigo" | null>(null);

  async function copiar(texto: string, cual: "enlace" | "codigo") {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(cual);
      setTimeout(() => setCopiado(null), 2000);
    } catch {
      window.prompt("Copia este texto:", texto);
    }
  }

  function imprimir() {
    const elemento = tarjeta.current;
    if (!elemento) return;
    elemento.setAttribute("data-imprimir", "si");
    document.documentElement.classList.add("imprimir-invitacion");
    const limpiar = () => {
      elemento.removeAttribute("data-imprimir");
      document.documentElement.classList.remove("imprimir-invitacion");
      window.removeEventListener("afterprint", limpiar);
    };
    window.addEventListener("afterprint", limpiar);
    window.print();
  }

  const boton = "inline-flex items-center gap-2 rounded-xl border border-bosque/20 bg-white px-3 py-2 text-sm font-bold text-bosque hover:bg-lima-suave";

  return (
    <div ref={tarjeta} className="rounded-3xl border-2 border-bosque/15 bg-white p-5">
      <style>{ESTILO_IMPRESION}</style>
      <div className="grid items-center gap-5 sm:grid-cols-[180px_1fr]">
        <div
          role="img"
          aria-label={`Código QR para unirse con el código ${codigo}`}
          className="mx-auto w-full max-w-[180px] rounded-2xl border-2 border-tinta bg-white p-2 [&_svg]:h-auto [&_svg]:w-full"
          dangerouslySetInnerHTML={{ __html: svg }}
        />
        <div className="min-w-0 text-center sm:text-left">
          <p className="text-xs font-bold uppercase tracking-wider text-tinta-suave">Código de invitación · VacInfo</p>
          <p className="font-mono text-5xl font-bold tracking-[0.2em] text-bosque">{codigo}</p>
          {detalle && <p className="mt-1 text-sm text-tinta-suave">{detalle}</p>}
          <p className="mt-3 break-all rounded-xl bg-lima-suave px-3 py-2 font-mono text-xs text-bosque">{enlace}</p>
          <div className="mt-3 flex flex-wrap justify-center gap-2 sm:justify-start print:hidden">
            <button type="button" className={boton} onClick={() => copiar(enlace, "enlace")}>
              {copiado === "enlace" ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
              {copiado === "enlace" ? "¡Enlace copiado!" : "Copiar enlace"}
            </button>
            <button type="button" className={boton} onClick={() => copiar(codigo, "codigo")}>
              {copiado === "codigo" ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
              {copiado === "codigo" ? "¡Código copiado!" : "Copiar código"}
            </button>
            <button type="button" className={boton} onClick={imprimir}>
              <Printer className="h-4 w-4" aria-hidden />
              Imprimir
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
