"use client";

import { useMemo, useState } from "react";
import { ChevronRight, Search, X } from "lucide-react";
import { control } from "@/components/campo/ui";
import { fecha } from "@/lib/formato";
import { ETIQUETA_ACCION } from "@/lib/offline/resumen";
import type { Accion, AnimalCatalogo, Catalogo } from "@/lib/offline/tipos";
import { ACCIONES_ANIMAL, Chip, FormularioAnimalRapido, type AccionAnimal } from "./formularios-rapidos";

const normalizar = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

function Etiquetas({ animal }: { animal: AnimalCatalogo }) {
  const etiquetas: { texto: string; clase: string }[] = [];
  if (animal.en_ordeno) etiquetas.push({ texto: "En ordeño", clase: "bg-blue-100 text-blue-800" });
  else if (animal.categoria === "vaca") etiquetas.push({ texto: "Horra / seca", clase: "bg-slate-100 text-slate-700" });
  if (animal.prenada) etiquetas.push({ texto: "Preñada", clase: "bg-emerald-100 text-emerald-800" });
  if (animal.categoria !== "vaca") etiquetas.push({ texto: animal.categoria, clase: "bg-amber-100 text-amber-900 capitalize" });
  return (
    <span className="flex flex-wrap gap-1">
      {etiquetas.map((e) => (
        <span key={e.texto} className={`rounded-full px-2 py-0.5 text-xs font-bold ${e.clase}`}>
          {e.texto}
        </span>
      ))}
    </span>
  );
}

export function AnimalRapido({
  catalogo,
  alGuardar,
}: {
  catalogo: Catalogo;
  alGuardar: (accion: Accion, datos: Record<string, unknown>, animal: AnimalCatalogo) => Promise<void>;
}) {
  const [busqueda, setBusqueda] = useState("");
  const [animalId, setAnimalId] = useState<string | null>(null);
  const [accion, setAccion] = useState<AccionAnimal>("ordeno");

  const indice = useMemo(
    () =>
      catalogo.animales
        .map((a) => ({ a, texto: normalizar(`${a.chapeta ?? ""} ${a.codigo} ${a.nombre}`) }))
        .sort((x, y) => (x.a.chapeta ?? x.a.codigo).localeCompare(y.a.chapeta ?? y.a.codigo, "es", { numeric: true })),
    [catalogo],
  );

  const resultados = useMemo(() => {
    const t = normalizar(busqueda.trim());
    if (!t) return indice.map((i) => i.a);
    const exactos = indice.filter(({ a }) => a.chapeta === t || normalizar(a.codigo) === t).map((i) => i.a);
    const parciales = indice.filter(({ a, texto }) => texto.includes(t) && !exactos.includes(a)).map((i) => i.a);
    return [...exactos, ...parciales];
  }, [indice, busqueda]);

  const animal = animalId ? catalogo.animales.find((a) => a.id === animalId) : undefined;

  if (animal) {
    return (
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3 rounded-2xl border border-blue-200 bg-blue-50 p-4">
          <div className="min-w-0">
            <p className="text-2xl font-bold leading-tight text-slate-900">{animal.chapeta ?? animal.codigo}</p>
            <p className="mb-1.5 truncate font-semibold text-slate-700">{animal.nombre}</p>
            <Etiquetas animal={animal} />
            {(animal.palpar_el || animal.secar_el) && (
              <p className="mt-1.5 text-xs text-slate-500">
                {animal.palpar_el && `Palpar el ${fecha(animal.palpar_el)}`}
                {animal.palpar_el && animal.secar_el && " · "}
                {animal.secar_el && `Secar el ${fecha(animal.secar_el)}`}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => setAnimalId(null)}
            className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-xl border border-slate-300 bg-white px-3 text-sm font-bold text-slate-700"
          >
            <X className="h-4 w-4" aria-hidden />
            Cambiar
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          {ACCIONES_ANIMAL.map((a) => (
            <Chip key={a} activo={a === accion} onClick={() => setAccion(a)}>
              {ETIQUETA_ACCION[a]}
            </Chip>
          ))}
        </div>

        <FormularioAnimalRapido
          key={`${animal.id}-${accion}`}
          accion={accion}
          animalId={animal.id}
          catalogo={catalogo}
          alGuardar={async (acc, datos) => {
            await alGuardar(acc, datos, animal);
            setAnimalId(null);
            setBusqueda("");
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <label className="relative block">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" aria-hidden />
        <span className="sr-only">Buscar animal</span>
        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && resultados.length > 0 && busqueda.trim()) setAnimalId(resultados[0].id);
          }}
          type="search"
          inputMode="search"
          enterKeyHint="search"
          autoComplete="off"
          placeholder="Chapeta, código o nombre"
          className={`${control} pl-12 text-lg`}
        />
      </label>
      <p className="px-1 text-sm text-slate-500">
        {busqueda.trim() ? `${resultados.length} encontrados` : `${catalogo.animales.length} animales en el teléfono`}
      </p>
      <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200">
        {resultados.slice(0, 60).map((a) => (
          <li key={a.id}>
            <button type="button" onClick={() => setAnimalId(a.id)} className="flex min-h-16 w-full items-center justify-between gap-3 px-4 py-2 text-left hover:bg-slate-50">
              <span className="min-w-0">
                <span className="mr-2 text-lg font-bold text-slate-900">{a.chapeta ?? a.codigo}</span>
                <span className="text-slate-700">{a.nombre}</span>
                <span className="mt-0.5 block">
                  <Etiquetas animal={a} />
                </span>
              </span>
              <ChevronRight className="h-5 w-5 shrink-0 text-slate-400" aria-hidden />
            </button>
          </li>
        ))}
        {resultados.length === 0 && <li className="p-5 text-center text-slate-500">No hay animales con ese dato en esta finca.</li>}
      </ul>
    </div>
  );
}
