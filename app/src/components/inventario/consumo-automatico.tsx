"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import clsx from "clsx";
import { Ban, CalendarCheck, Pencil, Plus, RotateCcw, Save, Trash2, X } from "lucide-react";
import { cambiarConsumoProgramado, guardarConsumoProgramado, type AccionRegla } from "@/app/(vacinfo)/inventario/actions";
import { Campo } from "@/components/fincas/campo";
import { Etiqueta } from "@/components/ui";
import { fecha } from "@/lib/formato";
import {
  cantidad,
  describirRegla,
  estadoRegla,
  ETIQUETA_GRUPO,
  GRUPOS_CONSUMO,
  plural,
  unidadesPorDia,
  type ConteosGrupo,
  type InsumoRegla,
  type ModoConsumo,
  type ReglaConsumo,
} from "./consumo";
import type { EstadoAccion } from "./opciones";

type Props = {
  fincaId: string;
  hoy: string;
  corte: string;
  reglas: ReglaConsumo[];
  insumos: InsumoRegla[];
  conteos: ConteosGrupo | null;
  puedeEditar: boolean;
  puedeBorrar: boolean;
};

export function ConsumoAutomatico({ fincaId, hoy, corte, reglas, insumos, conteos, puedeEditar, puedeBorrar }: Props) {
  // "nueva" abre el formulario vacío; un id abre la edición de esa regla.
  const [editando, setEditando] = useState<string | null>(null);
  const porId = new Map(insumos.map((i) => [i.id, i]));
  const cerrar = () => setEditando(null);

  return (
    <div className="space-y-4">
      {puedeEditar && insumos.length > 0 && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setEditando(editando === "nueva" ? null : "nueva")}
            className="boton-accion inline-flex items-center gap-2 rounded-xl bg-lima px-4 py-2 font-bold text-bosque"
          >
            <Plus className="h-4 w-4" aria-hidden />
            Nueva regla
          </button>
        </div>
      )}

      {editando === "nueva" && <FormularioRegla fincaId={fincaId} hoy={hoy} insumos={insumos} onCerrar={cerrar} />}

      {reglas.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-tinta/20 p-6 text-center text-tinta-suave">
          {insumos.length === 0 ? "Primero agrega insumos al catálogo." : "Esta finca no tiene reglas de consumo automático."}
        </p>
      ) : (
        <ul className="divide-y divide-tinta/10">
          {reglas.map((r) =>
            editando === r.id ? (
              <li key={r.id} className="py-3">
                <FormularioRegla fincaId={fincaId} hoy={hoy} regla={r} insumos={insumos} onCerrar={cerrar} />
              </li>
            ) : (
              <FilaRegla
                key={r.id}
                regla={r}
                insumo={porId.get(r.insumo_id)}
                conteos={conteos}
                corte={corte}
                puedeEditar={puedeEditar}
                puedeBorrar={puedeBorrar}
                onEditar={() => setEditando(r.id)}
              />
            ),
          )}
        </ul>
      )}
    </div>
  );
}

type PropsFila = {
  regla: ReglaConsumo;
  insumo?: InsumoRegla;
  conteos: ConteosGrupo | null;
  corte: string;
  puedeEditar: boolean;
  puedeBorrar: boolean;
  onEditar: () => void;
};

const BOTON = "inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold disabled:opacity-50";

function FilaRegla({ regla, insumo, conteos, corte, puedeEditar, puedeBorrar, onEditar }: PropsFila) {
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState<string>();
  const estado = estadoRegla(regla, corte);
  const diario = unidadesPorDia(regla, insumo, conteos);
  const vigente = estado.texto === "Activa";

  const ejecutar = (accion: AccionRegla) =>
    iniciar(async () => {
      const r = await cambiarConsumoProgramado(regla.id, accion);
      setError(r.error);
    });

  return (
    <li className="flex flex-wrap items-start gap-3 py-3">
      <div className="min-w-0 flex-1">
        <p className={clsx("font-bold text-bosque", !regla.activo && "line-through opacity-70")}>{describirRegla(regla, insumo)}</p>
        <p className="text-xs text-tinta-suave">
          Desde {fecha(regla.desde)}
          {regla.hasta ? ` hasta ${fecha(regla.hasta)}` : " · sin fecha final"}
          {vigente && diario != null && insumo && ` · al corte descuenta ${cantidad(Math.round(diario * 100) / 100)} ${plural(insumo.unidad, diario)} por día`}
          {regla.notas && ` · ${regla.notas}`}
        </p>
        {error && <p className="mt-1 text-xs font-bold text-alerta">{error}</p>}
      </div>
      <Etiqueta tono={estado.tono}>{estado.texto}</Etiqueta>
      {(puedeEditar || puedeBorrar) && (
        <div className="flex flex-wrap gap-1">
          {puedeEditar && (
            <button type="button" onClick={onEditar} className={clsx(BOTON, "text-bosque hover:bg-lima-suave")}>
              <Pencil className="h-3.5 w-3.5" aria-hidden />
              Editar
            </button>
          )}
          {puedeEditar && regla.activo && !regla.hasta && (
            <button
              type="button"
              disabled={pendiente}
              onClick={() => ejecutar("terminar")}
              title="Deja de descontar desde hoy; lo ya consumido se mantiene"
              className={clsx(BOTON, "text-bosque hover:bg-lima-suave")}
            >
              <CalendarCheck className="h-3.5 w-3.5" aria-hidden />
              Terminar hoy
            </button>
          )}
          {puedeEditar && (
            <button
              type="button"
              disabled={pendiente}
              onClick={() => ejecutar(regla.activo ? "anular" : "reactivar")}
              title={regla.activo ? "No descuenta nada, ni siquiera lo ya calculado" : "Vuelve a descontar según sus fechas"}
              className={clsx(BOTON, "text-tinta-suave hover:bg-black/5")}
            >
              {regla.activo ? <Ban className="h-3.5 w-3.5" aria-hidden /> : <RotateCcw className="h-3.5 w-3.5" aria-hidden />}
              {regla.activo ? "Desactivar" : "Reactivar"}
            </button>
          )}
          {puedeBorrar && (
            <button
              type="button"
              disabled={pendiente}
              onClick={() => confirm("¿Eliminar esta regla? Se deja de descontar todo su consumo.") && ejecutar("eliminar")}
              className={clsx(BOTON, "text-alerta hover:bg-[#fbe9e5]")}
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden />
              Eliminar
            </button>
          )}
        </div>
      )}
    </li>
  );
}

type PropsFormulario = { fincaId: string; hoy: string; regla?: ReglaConsumo; insumos: InsumoRegla[]; onCerrar: () => void };

function FormularioRegla({ fincaId, hoy, regla, insumos, onCerrar }: PropsFormulario) {
  const [estado, accion, enviando] = useActionState<EstadoAccion, FormData>(guardarConsumoProgramado, {});
  const [insumoId, setInsumoId] = useState(regla?.insumo_id ?? insumos[0]?.id ?? "");
  const [modo, setModo] = useState<ModoConsumo>(regla?.modo ?? "fijo");
  const [medida, setMedida] = useState(regla?.en_kg ? "kg" : "unidad");

  useEffect(() => {
    if (estado.ok) onCerrar();
  }, [estado, onCerrar]);

  const insumo = insumos.find((i) => i.id === insumoId);
  const conKg = !!insumo?.contenido;
  const medidaElegida = conKg ? medida : "unidad";

  return (
    <form action={accion} className="space-y-4 rounded-2xl border border-[#cadba8] bg-lima-suave/60 p-4">
      {regla && <input type="hidden" name="id" value={regla.id} />}
      <input type="hidden" name="finca_id" value={fincaId} />
      <input type="hidden" name="modo" value={modo} />

      <div role="radiogroup" aria-label="Cómo se calcula" className="grid gap-2 sm:grid-cols-2">
        {(
          [
            ["fijo", "Cantidad fija", "Lo mismo cada día, mes o año"],
            ["por_animal", "Según los animales", "Crece o baja con el número de animales del grupo"],
          ] as const
        ).map(([valor, titulo, ayuda]) => (
          <button
            key={valor}
            type="button"
            role="radio"
            aria-checked={modo === valor}
            onClick={() => setModo(valor)}
            className={clsx(
              "rounded-xl border px-4 py-2.5 text-left",
              modo === valor ? "border-pasto-oscuro bg-lima text-bosque" : "border-tinta/15 bg-white text-tinta-suave",
            )}
          >
            <span className="block font-bold">{titulo}</span>
            <span className="text-xs">{ayuda}</span>
          </button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Campo etiqueta="Insumo" className="lg:col-span-2">
          <select name="insumo_id" required value={insumoId} onChange={(e) => setInsumoId(e.target.value)} className="campo-control">
            {insumos.map((i) => (
              <option key={i.id} value={i.id}>
                {i.nombre} ({i.unidad}
                {i.contenido ? ` de ${i.contenido} kg` : ""})
              </option>
            ))}
          </select>
        </Campo>
        <Campo etiqueta="Cantidad">
          <input name="cantidad" required inputMode="decimal" defaultValue={regla?.cantidad ?? ""} placeholder="0,5" className="campo-control" />
        </Campo>
        <Campo etiqueta="Medida" ayuda={conKg ? undefined : "Para usar kg, indica el contenido del insumo en el catálogo"}>
          <select name="medida" value={medidaElegida} onChange={(e) => setMedida(e.target.value)} className="campo-control">
            <option value="unidad">{plural(insumo?.unidad ?? "unidad", 2)}</option>
            <option value="kg" disabled={!conKg}>
              kg
            </option>
          </select>
        </Campo>
        {modo === "por_animal" && (
          <Campo etiqueta="Por cada animal de" className="lg:col-span-2">
            <select name="grupo" required defaultValue={regla?.grupo ?? "vacas_ordeno"} className="campo-control">
              {GRUPOS_CONSUMO.map((g) => (
                <option key={g} value={g}>
                  {ETIQUETA_GRUPO[g]}
                </option>
              ))}
            </select>
          </Campo>
        )}
        <Campo etiqueta="Periodo">
          <select name="periodo" required defaultValue={regla?.periodo ?? "dia"} className="campo-control">
            <option value="dia">Por día</option>
            <option value="mes">Por mes (30 días)</option>
            <option value="anio">Por año (365 días)</option>
          </select>
        </Campo>
        <Campo etiqueta="Desde">
          <input type="date" name="desde" required defaultValue={regla?.desde ?? hoy} className="campo-control" />
        </Campo>
        <Campo etiqueta="Hasta (opcional)">
          <input type="date" name="hasta" defaultValue={regla?.hasta ?? ""} className="campo-control" />
        </Campo>
        <Campo etiqueta="Notas (opcional)" className={modo === "por_animal" ? "lg:col-span-3" : "lg:col-span-2"}>
          <input name="notas" maxLength={200} defaultValue={regla?.notas ?? ""} className="campo-control" />
        </Campo>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          disabled={enviando}
          className="boton-accion inline-flex items-center gap-2 rounded-xl bg-bosque px-4 py-2.5 font-bold text-leche disabled:opacity-60"
        >
          <Save className="h-4 w-4" aria-hidden />
          {enviando ? "Guardando…" : regla ? "Guardar cambios" : "Crear regla"}
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
