"use client";

import { useOptimistic, useTransition } from "react";
import Link from "next/link";
import clsx from "clsx";
import { AlertTriangle, EyeOff, RotateCcw, X } from "lucide-react";
import { fecha } from "@/lib/formato";
import { Etiqueta, Vacio } from "@/components/ui";
import { descartarAlertas, restaurarAlerta } from "./actions";
import type { AlertaDescartada, AlertaFinca } from "./alertas";

const URGENCIAS = [
  { id: "alta", titulo: "Urgente", tono: "rojo", clase: "border-alerta/25 bg-[#fbe9e5]" },
  { id: "media", titulo: "Esta semana", tono: "amarillo", clase: "border-dorado/50 bg-[#fdf4dc]" },
  { id: "baja", titulo: "Para tener en cuenta", tono: "gris", clase: "border-[#cadba8] bg-lima-suave" },
] as const;

const id = (a: AlertaFinca) => `${a.finca_id}|${a.clave}`;
const carga = (lista: AlertaFinca[]) =>
  JSON.stringify(lista.map(({ finca_id, tipo, animal_id, nombre, fecha }) => ({ finca_id, tipo, animal_id, nombre, fecha })));

const botonChico = "inline-flex items-center gap-1 rounded-lg border border-tinta/15 bg-white/70 px-2 py-1 text-xs font-bold text-tinta-suave hover:bg-white disabled:opacity-50";

export function Notificaciones({
  visibles,
  descartadas,
  verDescartadas,
}: {
  visibles: AlertaFinca[];
  descartadas: AlertaDescartada[];
  verDescartadas: boolean;
}) {
  // Oculta al instante lo que se descarta o restaura; al revalidar llega la lista real del servidor.
  const [ocultas, ocultar] = useOptimistic(new Set<string>(), (s, ids: string[]) => new Set([...s, ...ids]));
  const [, iniciar] = useTransition();

  const descartar = (lista: AlertaFinca[]) =>
    iniciar(async () => {
      ocultar(lista.map(id));
      const datos = new FormData();
      datos.set("alertas", carga(lista));
      await descartarAlertas(datos);
    });

  const restaurar = (a: AlertaDescartada) =>
    iniciar(async () => {
      ocultar([id(a)]);
      const datos = new FormData();
      datos.set("finca_id", a.finca_id);
      datos.set("clave", a.clave);
      await restaurarAlerta(datos);
    });

  const lista = visibles.filter((a) => !ocultas.has(id(a)));
  const ocultasLista = descartadas.filter((a) => !ocultas.has(id(a)));

  return (
    <div className="space-y-5">
      {lista.length === 0 ? (
        <Vacio>{descartadas.length ? "No quedan alertas pendientes: las demás están descartadas." : "No hay alertas pendientes en ninguna finca."}</Vacio>
      ) : (
        URGENCIAS.map((u) => {
          const grupo = lista.filter((a) => a.prioridad === u.id);
          if (grupo.length === 0) return null;
          return (
            <section key={u.id} aria-labelledby={`grupo-${u.id}`}>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <h3 id={`grupo-${u.id}`} className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-tinta-suave">
                  {u.id === "alta" && <AlertTriangle className="h-4 w-4 text-alerta" aria-hidden />}
                  {u.titulo} <Etiqueta tono={u.tono}>{grupo.length}</Etiqueta>
                </h3>
                {grupo.length > 1 && (
                  <button type="button" onClick={() => descartar(grupo)} className={clsx(botonChico, "print:hidden")}>
                    <EyeOff className="h-3.5 w-3.5" aria-hidden />
                    Descartar todas las de este grupo
                  </button>
                )}
              </div>
              <ul className="space-y-2">
                {grupo.map((a) => (
                  <li key={id(a)} className={clsx("rounded-2xl border p-3", u.clase)}>
                    <div className="flex items-start justify-between gap-3">
                      <strong className="text-bosque">
                        {a.chapeta ? `${a.chapeta} · ` : ""}
                        {a.nombre}
                      </strong>
                      <span className="shrink-0 text-xs font-bold text-tinta-suave">{fecha(a.fecha)}</span>
                    </div>
                    <p className="text-sm">{a.detalle}</p>
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <p className="text-xs text-tinta-suave">{a.finca}</p>
                      <button
                        type="button"
                        onClick={() => descartar([a])}
                        className={clsx(botonChico, "print:hidden")}
                        aria-label={`Descartar alerta de ${a.nombre}: ${a.detalle}`}
                      >
                        <X className="h-3.5 w-3.5" aria-hidden />
                        Descartar
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          );
        })
      )}

      {descartadas.length > 0 && (
        <div className="border-t border-tinta/10 pt-4 print:hidden">
          <Link href={verDescartadas ? "/mensajes" : "/mensajes?descartadas=1#notificaciones"} scroll={false} className={botonChico} aria-expanded={verDescartadas}>
            <EyeOff className="h-3.5 w-3.5" aria-hidden />
            {verDescartadas ? "Ocultar descartadas" : `Ver descartadas (${descartadas.length})`}
          </Link>
          {verDescartadas && (
            <ul className="mt-3 divide-y divide-tinta/10">
              {ocultasLista.map((a) => (
                <li key={id(a)} className="flex items-start justify-between gap-3 py-2 text-sm opacity-80">
                  <div>
                    <strong className="text-bosque">
                      {a.chapeta ? `${a.chapeta} · ` : ""}
                      {a.nombre}
                    </strong>{" "}
                    <span className="text-xs text-tinta-suave">
                      {fecha(a.fecha)} · {a.finca}
                    </span>
                    <p className="text-tinta-suave">{a.detalle}</p>
                    {a.visible_desde && <p className="text-xs text-tinta-suave">Vuelve a aparecer el {fecha(a.visible_desde)} si sigue pendiente.</p>}
                  </div>
                  <button type="button" onClick={() => restaurar(a)} className={botonChico} aria-label={`Restaurar alerta de ${a.nombre}`}>
                    <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                    Restaurar
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
