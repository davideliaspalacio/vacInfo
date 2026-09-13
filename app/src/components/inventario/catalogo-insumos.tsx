"use client";

import { useActionState, useEffect, useState } from "react";
import clsx from "clsx";
import { Pencil, Plus, Save, X } from "lucide-react";
import { guardarInsumo } from "@/app/(vacinfo)/inventario/actions";
import { Campo } from "@/components/fincas/campo";
import { CATEGORIAS_INSUMO, ETIQUETA_CATEGORIA, ETIQUETA_FUENTE, FUENTES_CONSUMO, type EstadoAccion, type FuenteConsumo, type Insumo } from "./opciones";

const pesos = (v: number | null) => (v == null ? "—" : v.toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }));
const num = (v: number | null) => (v == null ? "—" : v.toLocaleString("es-CO", { maximumFractionDigits: 2 }));

export function CatalogoInsumos({ insumos }: { insumos: Insumo[] }) {
  // "nuevo" abre el formulario vacío; un id abre la edición de ese insumo.
  const [editando, setEditando] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setEditando(editando === "nuevo" ? null : "nuevo")}
          className="boton-accion inline-flex items-center gap-2 rounded-xl bg-lima px-4 py-2 font-bold text-bosque"
        >
          <Plus className="h-4 w-4" aria-hidden />
          Nuevo insumo
        </button>
      </div>

      {editando === "nuevo" && <FormularioInsumo insumos={insumos} onCerrar={() => setEditando(null)} />}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b-2 border-bosque text-left text-xs uppercase text-tinta-suave">
              <th className="py-2 pr-2">Insumo</th>
              <th className="px-2 py-2">Categoría</th>
              <th className="px-2 py-2">Unidad</th>
              <th className="px-2 py-2 text-right">Precio</th>
              <th className="px-2 py-2 text-right">Mínimo</th>
              <th className="px-2 py-2">Se descuenta de</th>
              <th className="py-2 pl-2" />
            </tr>
          </thead>
          <tbody>
            {insumos.map((i) =>
              editando === i.id ? (
                <tr key={i.id}>
                  <td colSpan={7} className="py-3">
                    <FormularioInsumo insumo={i} insumos={insumos} onCerrar={() => setEditando(null)} />
                  </td>
                </tr>
              ) : (
                <tr key={i.id} className="border-b border-tinta/10">
                  <td className="py-2 pr-2 font-bold text-bosque">{i.nombre}</td>
                  <td className="px-2 py-2">{ETIQUETA_CATEGORIA[i.categoria]}</td>
                  <td className="px-2 py-2">
                    {i.unidad}
                    {i.contenido ? <span className="text-tinta-suave"> · {num(i.contenido)} kg</span> : null}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">{pesos(i.precio)}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{num(i.stock_minimo)}</td>
                  <td className="px-2 py-2">
                    {i.consumo_diario_fuente ? (
                      <span className="rounded-full bg-lima-suave px-2 py-0.5 text-xs font-bold text-bosque">
                        Consumo diario · {ETIQUETA_FUENTE[i.consumo_diario_fuente as FuenteConsumo]?.toLowerCase()}
                      </span>
                    ) : (
                      <span className="text-tinta-suave">Solo salidas</span>
                    )}
                  </td>
                  <td className="py-2 pl-2 text-right">
                    <button
                      type="button"
                      onClick={() => setEditando(i.id)}
                      className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold text-bosque hover:bg-lima-suave"
                    >
                      <Pencil className="h-3.5 w-3.5" aria-hidden />
                      Editar
                    </button>
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FormularioInsumo({ insumo, insumos, onCerrar }: { insumo?: Insumo; insumos: Insumo[]; onCerrar: () => void }) {
  const [estado, accion, enviando] = useActionState<EstadoAccion, FormData>(guardarInsumo, {});
  const [fuente, setFuente] = useState(insumo?.consumo_diario_fuente ?? "");

  useEffect(() => {
    if (estado.ok) onCerrar();
  }, [estado, onCerrar]);

  const ocupada = fuente ? insumos.find((i) => i.consumo_diario_fuente === fuente && i.id !== insumo?.id) : undefined;

  return (
    <form action={accion} className="space-y-4 rounded-2xl border border-[#cadba8] bg-lima-suave/60 p-4">
      {insumo && <input type="hidden" name="id" value={insumo.id} />}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Campo etiqueta="Nombre" className="lg:col-span-2">
          <input name="nombre" required maxLength={120} defaultValue={insumo?.nombre} className="campo-control" />
        </Campo>
        <Campo etiqueta="Categoría">
          <select name="categoria" required defaultValue={insumo?.categoria ?? "concentrado"} className="campo-control">
            {CATEGORIAS_INSUMO.map((c) => (
              <option key={c} value={c}>
                {ETIQUETA_CATEGORIA[c]}
              </option>
            ))}
          </select>
        </Campo>
        <Campo etiqueta="Unidad">
          <input name="unidad" required maxLength={30} defaultValue={insumo?.unidad ?? "bulto"} className="campo-control" />
        </Campo>
        <Campo etiqueta="Contenido (kg por unidad)" ayuda="Necesario para descontar el consumo diario">
          <input name="contenido" inputMode="decimal" defaultValue={insumo?.contenido ?? ""} className="campo-control" />
        </Campo>
        <Campo etiqueta="Precio por unidad">
          <input name="precio" inputMode="numeric" defaultValue={insumo?.precio ?? ""} className="campo-control" />
        </Campo>
        <Campo etiqueta="Stock mínimo" ayuda="Por debajo se marca como bajo">
          <input name="stock_minimo" inputMode="decimal" defaultValue={insumo?.stock_minimo ?? ""} className="campo-control" />
        </Campo>
        <Campo etiqueta="Se descuenta del consumo diario de…">
          <select name="consumo_diario_fuente" value={fuente} onChange={(e) => setFuente(e.target.value)} className="campo-control">
            <option value="">Nada (solo salidas registradas)</option>
            {FUENTES_CONSUMO.map((f) => (
              <option key={f} value={f}>
                {ETIQUETA_FUENTE[f]}
              </option>
            ))}
          </select>
        </Campo>
      </div>

      {ocupada && (
        <label className="flex items-start gap-2 rounded-xl border border-dorado bg-dorado/20 p-3 text-sm text-[#6b4a09]">
          <input type="checkbox" name="reemplazar_fuente" value="1" className="mt-1" />
          <span>
            El consumo diario de <strong>{ETIQUETA_FUENTE[fuente as FuenteConsumo].toLowerCase()}</strong> ya se descuenta de{" "}
            <strong>{ocupada.nombre}</strong>. Solo puede descontarse de un insumo: marca esta casilla para pasarlo a este.
          </span>
        </label>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          disabled={enviando}
          className="boton-accion inline-flex items-center gap-2 rounded-xl bg-bosque px-4 py-2.5 font-bold text-leche disabled:opacity-60"
        >
          <Save className="h-4 w-4" aria-hidden />
          {enviando ? "Guardando…" : insumo ? "Guardar cambios" : "Agregar al catálogo"}
        </button>
        <button type="button" onClick={onCerrar} className="inline-flex items-center gap-1 rounded-xl px-3 py-2 font-bold text-tinta-suave hover:bg-black/5">
          <X className="h-4 w-4" aria-hidden />
          Cancelar
        </button>
        <p aria-live="polite" className={clsx("text-sm font-bold", estado.error ? "text-alerta" : "text-pasto-oscuro")}>
          {estado.error ?? ""}
        </p>
      </div>
    </form>
  );
}
