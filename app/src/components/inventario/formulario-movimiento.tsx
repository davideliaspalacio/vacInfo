"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { PackagePlus } from "lucide-react";
import { registrarMovimiento } from "@/app/(vacinfo)/inventario/actions";
import { Campo } from "@/components/fincas/campo";
import type { EstadoAccion, Insumo } from "./opciones";

type Props = {
  fincaId: string;
  hoy: string;
  catalogo: Pick<Insumo, "nombre" | "unidad" | "contenido">[];
};

export function FormularioMovimiento({ fincaId, hoy, catalogo }: Props) {
  const [tipo, setTipo] = useState<"ingreso" | "salida">("ingreso");
  const [producto, setProducto] = useState("");
  const [estado, accion, enviando] = useActionState<EstadoAccion, FormData>(async (previo, datos) => {
    const r = await registrarMovimiento(previo, datos);
    if (r.ok) setProducto("");
    return r;
  }, {});
  const formulario = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (estado.ok) formulario.current?.reset();
  }, [estado]);

  const insumo = catalogo.find((i) => i.nombre.toLowerCase() === producto.trim().toLowerCase());

  return (
    <form ref={formulario} action={accion} className="space-y-4">
      <input type="hidden" name="finca_id" value={fincaId} />
      <input type="hidden" name="tipo" value={tipo} />

      <div role="radiogroup" aria-label="Tipo de movimiento" className="grid grid-cols-2 gap-2">
        {(["ingreso", "salida"] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="radio"
            aria-checked={tipo === t}
            onClick={() => setTipo(t)}
            className={clsx(
              "rounded-xl border px-4 py-2.5 font-bold",
              tipo === t ? (t === "ingreso" ? "border-pasto-oscuro bg-lima text-bosque" : "border-cafe bg-crema text-cafe") : "border-tinta/15 text-tinta-suave",
            )}
          >
            {t === "ingreso" ? "Ingreso (llegó)" : "Salida (se usó)"}
          </button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
        <Campo
          etiqueta="Producto"
          ayuda={
            producto.trim()
              ? insumo
                ? `En catálogo · se cuenta en ${insumo.unidad}${insumo.contenido ? ` de ${insumo.contenido} kg` : ""}`
                : "No está en el catálogo: se registrará con este nombre"
              : undefined
          }
        >
          <input
            name="producto"
            list="catalogo-insumos"
            required
            maxLength={120}
            value={producto}
            onChange={(e) => setProducto(e.target.value)}
            className="campo-control"
            placeholder="Concentrado vacas leche"
          />
          <datalist id="catalogo-insumos">
            {catalogo.map((i) => (
              <option key={i.nombre} value={i.nombre} />
            ))}
          </datalist>
        </Campo>
        <Campo etiqueta={`Cantidad${insumo ? ` (${insumo.unidad})` : ""}`}>
          <input name="cantidad" inputMode="decimal" required className="campo-control" placeholder="0" />
        </Campo>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Campo etiqueta="Fecha">
          <input type="date" name="fecha" required defaultValue={hoy} max={hoy} className="campo-control" />
        </Campo>
        <Campo etiqueta="Hora">
          <input type="time" name="hora" className="campo-control" />
        </Campo>
        <Campo etiqueta="Entrega">
          <input name="entrega" maxLength={80} className="campo-control" placeholder={tipo === "ingreso" ? "Proveedor" : "Bodega"} />
        </Campo>
        <Campo etiqueta="Recibe">
          <input name="recibe" maxLength={80} className="campo-control" placeholder={tipo === "ingreso" ? "Mayordomo" : "Ordeñador"} />
        </Campo>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          disabled={enviando}
          className="boton-accion inline-flex items-center gap-2 rounded-xl bg-bosque px-5 py-3 font-bold text-leche disabled:opacity-60"
        >
          <PackagePlus className="h-4 w-4" aria-hidden />
          {enviando ? "Guardando…" : "Registrar movimiento"}
        </button>
        <p aria-live="polite" className={clsx("text-sm font-bold", estado.error ? "text-alerta" : "text-pasto-oscuro")}>
          {estado.error ?? estado.mensaje ?? ""}
        </p>
      </div>
    </form>
  );
}
