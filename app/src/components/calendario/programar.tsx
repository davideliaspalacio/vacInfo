"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { CalendarPlus, Save } from "lucide-react";
import { programarEvento } from "@/app/(vacinfo)/calendario/actions";
import { Campo } from "@/components/fincas/campo";
import type { EstadoAccion } from "@/components/inventario/opciones";
import { ETIQUETA_PROGRAMADO, TIPOS_PROGRAMABLES } from "./programados";

export type AnimalOpcion = { id: string; nombre: string; chapeta: string | null; categoria: string };

type Props = { fincaId: string; fechaInicial: string; animales: AnimalOpcion[] };

export function ProgramarEvento({ fincaId, fechaInicial, animales }: Props) {
  const [abierto, setAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [animal, setAnimal] = useState("");
  const formulario = useRef<HTMLFormElement>(null);
  const [estado, accion, enviando] = useActionState<EstadoAccion, FormData>(async (previo, datos) => {
    const r = await programarEvento(previo, datos);
    if (r.ok) {
      setAnimal("");
      setBusqueda("");
    }
    return r;
  }, {});

  useEffect(() => {
    if (estado.ok) formulario.current?.reset();
  }, [estado]);

  const q = busqueda.trim().toLowerCase();
  const visibles = q
    ? animales.filter((a) => a.id === animal || a.nombre.toLowerCase().includes(q) || a.chapeta?.toLowerCase().includes(q))
    : animales;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold text-bosque">Programar evento</h2>
          <p className="text-sm text-tinta-suave">Vacunaciones, visitas, fumigaciones o cualquier tarea: se ven en el calendario y avisan en Mensajes.</p>
        </div>
        <button
          type="button"
          onClick={() => setAbierto((a) => !a)}
          aria-expanded={abierto}
          className="boton-accion inline-flex items-center gap-2 rounded-xl bg-lima px-4 py-2 font-bold text-bosque"
        >
          <CalendarPlus className="h-4 w-4" aria-hidden />
          {abierto ? "Ocultar formulario" : "Programar evento"}
        </button>
      </div>

      {abierto && (
        <form ref={formulario} action={accion} className="mt-5 space-y-4 border-t border-tinta/10 pt-5">
          <input type="hidden" name="finca_id" value={fincaId} />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Campo etiqueta="Fecha">
              <input type="date" name="fecha" required defaultValue={fechaInicial} className="campo-control" />
            </Campo>
            <Campo etiqueta="Hora (opcional)">
              <input type="time" name="hora" className="campo-control" />
            </Campo>
            <Campo etiqueta="Tipo">
              <select name="tipo" required defaultValue="vacunacion" className="campo-control">
                {TIPOS_PROGRAMABLES.map((t) => (
                  <option key={t} value={t}>
                    {ETIQUETA_PROGRAMADO[t]}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo etiqueta="Avisar con anticipación" ayuda="Días antes en que aparece en Mensajes">
              <input type="number" name="recordar_dias" min={0} max={60} defaultValue={1} className="campo-control" />
            </Campo>
            <Campo etiqueta="Título" className="sm:col-span-2">
              <input name="titulo" required maxLength={120} placeholder="Vacuna de aftosa a todo el hato" className="campo-control" />
            </Campo>
            <Campo etiqueta="Buscar animal (opcional)">
              <input
                type="search"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Nombre o chapeta"
                className="campo-control"
              />
            </Campo>
            <Campo etiqueta="Animal" ayuda={q ? `${visibles.length} coinciden` : undefined}>
              <select name="animal_id" value={animal} onChange={(e) => setAnimal(e.target.value)} className="campo-control">
                <option value="">Toda la finca (sin animal)</option>
                {visibles.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.chapeta ? `${a.chapeta} · ` : ""}
                    {a.nombre} ({a.categoria})
                  </option>
                ))}
              </select>
            </Campo>
            <Campo etiqueta="Descripción (opcional)" className="sm:col-span-2 lg:col-span-4">
              <textarea name="descripcion" rows={3} maxLength={1000} className="campo-control" />
            </Campo>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              disabled={enviando}
              className="boton-accion inline-flex items-center gap-2 rounded-xl bg-bosque px-5 py-3 font-bold text-leche disabled:opacity-60"
            >
              <Save className="h-4 w-4" aria-hidden />
              {enviando ? "Guardando…" : "Guardar evento"}
            </button>
            <p aria-live="polite" className={clsx("text-sm font-bold", estado.error ? "text-alerta" : "text-pasto-oscuro")}>
              {estado.error ?? estado.mensaje ?? ""}
            </p>
          </div>
        </form>
      )}
    </div>
  );
}
