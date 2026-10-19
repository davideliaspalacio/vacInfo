"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { ArrowDown, CircleCheck, TriangleAlert, Wand2 } from "lucide-react";
import { fecha, num } from "@/lib/formato";
import { CATEGORIAS } from "@/components/fincas/etiquetas";
import { Etiqueta, Vacio } from "@/components/ui";
import type { EstadoAccion } from "@/components/fincas/formulario-accion";
import { registrosDe, type DefinicionCaso, type FilaRevision } from "./casos";

type Props = {
  definicion: DefinicionCaso;
  /** Filas de la página visible (la lista completa se pagina en el servidor). */
  filas: FilaRevision[];
  /** Animales del grupo en total, contando las demás páginas. */
  total: number;
  accion?: (estado: EstadoAccion, datos: FormData) => Promise<EstadoAccion>;
  /** Etapa a la que baja el botón del grupo «bajar» (hoy: novilla). */
  etapaDestino?: string;
  soloLectura: boolean;
};

export function GrupoEtapas({ definicion, filas, total, accion, etapaDestino, soloLectura }: Props) {
  if (!filas.length) return <Vacio>{definicion.vacio}</Vacio>;
  if (!accion || soloLectura) return <Tabla definicion={definicion} filas={filas} />;
  return <GrupoConAccion definicion={definicion} filas={filas} total={total} accion={accion} etapaDestino={etapaDestino} />;
}

function GrupoConAccion({
  definicion,
  filas,
  total,
  accion,
  etapaDestino,
}: Required<Pick<Props, "definicion" | "filas" | "total" | "accion">> & { etapaDestino?: string }) {
  const [estado, enviar, pendiente] = useActionState(accion, {});
  const [elegidos, setElegidos] = useState<string[]>([]);

  // Tras aplicar, los animales corregidos salen del grupo: las marcas que quedaron en memoria se
  // descartan al cruzarlas con lo que sigue en la lista, sin necesidad de limpiarlas a mano.
  const visibles = filas.map((f) => f.animal_id);
  const marcados = elegidos.filter((id) => visibles.includes(id));
  const todasMarcadas = visibles.every((id) => marcados.includes(id));
  const alternar = (id: string) => setElegidos((m) => (m.includes(id) ? m.filter((x) => x !== id) : [...m, id]));
  const esBaja = definicion.accion === "bajar";

  return (
    <form action={enviar} className="space-y-4">
      {esBaja && <input type="hidden" name="etapa" value={etapaDestino} />}
      <Tabla
        definicion={definicion}
        filas={filas}
        marcados={marcados}
        onMarcar={alternar}
        onMarcarTodas={() => setElegidos(todasMarcadas ? [] : visibles)}
        todasMarcadas={todasMarcadas}
        pendiente={pendiente}
      />

      <div className="flex flex-wrap items-center gap-3 border-t border-black/10 pt-4">
        <button
          disabled={pendiente || !marcados.length}
          className="boton-accion inline-flex items-center gap-2 rounded-xl bg-bosque px-4 py-2.5 text-sm font-bold text-leche disabled:opacity-50"
        >
          {esBaja ? <ArrowDown className="h-4 w-4" aria-hidden /> : <Wand2 className="h-4 w-4" aria-hidden />}
          {pendiente ? "Guardando…" : esBaja ? `Bajar a ${etapaDestino} los marcados` : "Aplicar a los marcados"}
          {marcados.length ? ` (${marcados.length})` : ""}
        </button>

        {/* «Aplicar a todos» no se limita a la página: la base recorre toda la finca. */}
        {!esBaja && (
          <button
            name="todos"
            value="1"
            disabled={pendiente}
            className="inline-flex items-center gap-2 rounded-xl border border-bosque/25 bg-white px-4 py-2.5 text-sm font-bold text-bosque hover:bg-lima-suave disabled:opacity-50"
          >
            Aplicar a todos ({num(total)})
          </button>
        )}

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

function Tabla({
  definicion,
  filas,
  marcados,
  onMarcar,
  onMarcarTodas,
  todasMarcadas,
  pendiente,
}: {
  definicion: DefinicionCaso;
  filas: FilaRevision[];
  marcados?: string[];
  onMarcar?: (id: string) => void;
  onMarcarTodas?: () => void;
  todasMarcadas?: boolean;
  pendiente?: boolean;
}) {
  const conCasillas = !!onMarcar;
  const esCambio = definicion.caso === "pendiente";
  const esBaja = definicion.accion === "bajar";

  return (
    <div className="overflow-x-auto">
      <table className="matriz w-full border-collapse bg-white text-sm">
        <thead>
          <tr>
            {conCasillas && (
              <th className="w-10">
                <input
                  type="checkbox"
                  checked={!!todasMarcadas}
                  onChange={onMarcarTodas}
                  aria-label={`Marcar los animales de «${definicion.titulo}» en esta página`}
                  className="h-4 w-4 accent-bosque"
                />
              </th>
            )}
            <th>Chapeta</th>
            <th>Nombre</th>
            <th>Etapa actual</th>
            {esCambio && <th>Le corresponde</th>}
            {esCambio && <th>Motivo</th>}
            <th>Nacimiento</th>
            <th>Edad (meses)</th>
            <th>Registros</th>
            {conCasillas && <th>{esBaja ? "Bajar" : "Aplicar"}</th>}
          </tr>
        </thead>
        <tbody>
          {filas.map((f) => (
            <tr key={f.animal_id} className={clsx(marcados?.includes(f.animal_id) ? "bg-lima-suave" : "hover:bg-lima-suave")}>
              {conCasillas && (
                <td>
                  <input
                    type="checkbox"
                    name="animales"
                    value={f.animal_id}
                    checked={marcados?.includes(f.animal_id) ?? false}
                    onChange={() => onMarcar?.(f.animal_id)}
                    aria-label={`Marcar ${f.nombre}`}
                    className="h-4 w-4 accent-bosque"
                  />
                </td>
              )}
              <td className="font-mono font-bold">{f.chapeta ?? f.codigo}</td>
              <td className="!text-left">
                <Link href={`/animales/${f.animal_id}`} className="font-bold text-bosque hover:underline">
                  {f.nombre}
                </Link>
              </td>
              <td>
                <Etiqueta tono="gris">{CATEGORIAS[f.categoria]}</Etiqueta>
              </td>
              {esCambio && (
                <td>
                  <Etiqueta tono="verde">{f.etapa_nueva ? CATEGORIAS[f.etapa_nueva] : "—"}</Etiqueta>
                </td>
              )}
              {esCambio && <td className="!whitespace-normal !text-left">{f.motivo ?? "—"}</td>}
              <td className={clsx(!f.fecha_nacimiento && "font-bold text-alerta")}>{f.fecha_nacimiento ? fecha(f.fecha_nacimiento) : "Falta"}</td>
              <td>{num(f.edad_meses)}</td>
              <td className="!whitespace-normal !text-left">{registrosDe(f)}</td>
              {conCasillas && (
                <td>
                  <button
                    name="solo"
                    value={f.animal_id}
                    disabled={pendiente}
                    className="rounded-lg px-2 py-1 text-xs font-bold text-bosque underline-offset-2 hover:bg-lima-suave hover:underline disabled:opacity-50"
                  >
                    {esBaja ? "Bajar" : "Aplicar"}
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
