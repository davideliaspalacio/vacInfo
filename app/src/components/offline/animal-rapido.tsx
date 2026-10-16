"use client";

import { useMemo, useState } from "react";
import { ChevronRight, Search, TriangleAlert, X } from "lucide-react";
import { control } from "@/components/campo/ui";
import { fecha, hoyISO } from "@/lib/formato";
import { jornadaLibre, textoJornadasCompletas } from "@/lib/offline/ordenos";
import type { Accion, AnimalCatalogo, Catalogo } from "@/lib/offline/tipos";
import { Chip, ETIQUETA_ACCION_ANIMAL, FormularioAnimalRapido, accionesDe, jornadaActual, type AccionAnimal } from "./formularios-rapidos";

const normalizar = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

function Etiquetas({ animal }: { animal: AnimalCatalogo }) {
  const etiquetas: { texto: string; clase: string }[] = [];
  if (animal.en_ordeno) etiquetas.push({ texto: "En ordeño", clase: "bg-blue-100 text-blue-800" });
  else if (animal.categoria === "vaca") etiquetas.push({ texto: "Seca", clase: "bg-slate-100 text-slate-700" });
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
  animalInicial,
  indice,
  alGuardar,
}: {
  catalogo: Catalogo;
  /** Animal preseleccionado desde un enlace (?animal=). */
  animalInicial?: string | null;
  /** Ordeños que el teléfono ya conoce (catálogo + cola pendiente). */
  indice: Set<string>;
  alGuardar: (accion: Accion, datos: Record<string, unknown>, animal: AnimalCatalogo) => Promise<void>;
}) {
  const [busqueda, setBusqueda] = useState("");
  // La chapeta se digita a mano; con el teclado numérico por defecto y uno de letras para buscar por nombre.
  const [teclado, setTeclado] = useState<"numero" | "nombre">("numero");
  const [animalId, setAnimalId] = useState<string | null>(() =>
    animalInicial && catalogo.animales.some((a) => a.id === animalInicial) ? animalInicial : null,
  );
  const [accion, setAccion] = useState<AccionAnimal>("ordeno");
  const [aviso, setAviso] = useState<string | null>(() =>
    animalInicial && !catalogo.animales.some((a) => a.id === animalInicial)
      ? `El animal del enlace no está en los datos de ${catalogo.finca.nombre}. Puede ser de otra finca o haber salido del inventario.`
      : null,
  );

  const indiceAnimales = useMemo(
    () =>
      catalogo.animales
        .map((a) => ({ a, texto: normalizar(`${a.chapeta ?? ""} ${a.codigo} ${a.nombre}`) }))
        .sort((x, y) => (x.a.chapeta ?? x.a.codigo).localeCompare(y.a.chapeta ?? y.a.codigo, "es", { numeric: true })),
    [catalogo],
  );

  const resultados = useMemo(() => {
    const t = normalizar(busqueda);
    if (!t) return indiceAnimales.map((i) => i.a);
    const exactos = indiceAnimales.filter(({ a }) => a.chapeta === t || normalizar(a.codigo) === t).map((i) => i.a);
    const parciales = indiceAnimales.filter(({ a, texto }) => texto.includes(t) && !exactos.includes(a)).map((i) => i.a);
    return [...exactos, ...parciales];
  }, [indiceAnimales, busqueda]);

  const animal = animalId ? catalogo.animales.find((a) => a.id === animalId) : undefined;

  if (animal) {
    const disponibles = accionesDe(animal);
    // Sin jornada libre hoy no hay nada que registrar: el botón de Ordeño se deshabilita y dice por qué.
    const hoy = hoyISO();
    const libre = jornadaLibre(indice, animal.id, hoy, jornadaActual());
    const motivoOrdeno = libre ? null : `${textoJornadasCompletas(hoy, hoy)} No se puede registrar otro ordeño de esta vaca hoy.`;
    const posibles = disponibles.filter((a) => a !== "ordeno" || !motivoOrdeno);
    const actual = posibles.includes(accion) ? accion : posibles[0];

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

        <div>
          <div className="flex flex-wrap gap-2">
            {disponibles.map((a) => (
              <Chip
                key={a}
                activo={a === actual}
                bloqueado={a === "ordeno" && Boolean(motivoOrdeno)}
                motivo={a === "ordeno" ? (motivoOrdeno ?? undefined) : undefined}
                onClick={() => setAccion(a)}
              >
                {ETIQUETA_ACCION_ANIMAL[a]}
              </Chip>
            ))}
          </div>
          {motivoOrdeno && (
            <p role="status" className="mt-2 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-900">
              {motivoOrdeno}
            </p>
          )}
        </div>

        <FormularioAnimalRapido
          key={`${animal.id}-${actual}`}
          accion={actual}
          animal={animal}
          catalogo={catalogo}
          indice={indice}
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
      {aviso && (
        <p role="alert" className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-900">
          <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
          {aviso}
        </p>
      )}

      <label className="block">
        <span className="mb-2 block text-lg font-bold text-slate-800">Escribe la chapeta</span>
        <span className="relative block">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" aria-hidden />
          <input
            // Al cambiar de teclado se vuelve a montar para que el celular muestre el teclado nuevo.
            key={teclado}
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && resultados.length > 0 && busqueda.trim()) setAnimalId(resultados[0].id);
            }}
            type="text"
            inputMode={teclado === "numero" ? "numeric" : "search"}
            enterKeyHint="search"
            autoComplete="off"
            placeholder={teclado === "numero" ? "Número de la chapeta" : "Nombre de la vaca"}
            className={`${control} pl-12 text-2xl font-bold`}
          />
        </span>
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-slate-500">Teclado:</span>
        <Chip activo={teclado === "numero"} onClick={() => setTeclado("numero")}>
          123 Números
        </Chip>
        <Chip activo={teclado === "nombre"} onClick={() => setTeclado("nombre")}>
          Abc Nombre
        </Chip>
      </div>
      <p className="px-1 text-sm text-slate-500">
        {busqueda.trim() ? `${resultados.length} encontrados` : `${catalogo.animales.length} animales en el teléfono`}
      </p>
      <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200">
        {resultados.slice(0, 60).map((a) => (
          <li key={a.id}>
            <button
              type="button"
              onClick={() => {
                setAviso(null);
                setAnimalId(a.id);
              }}
              className="flex min-h-16 w-full items-center justify-between gap-3 px-4 py-2 text-left hover:bg-slate-50"
            >
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
