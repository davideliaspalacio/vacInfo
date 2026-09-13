"use client";

import { useMemo, useRef, useState, type KeyboardEvent } from "react";
import clsx from "clsx";
import { Save, Search } from "lucide-react";
import { control } from "@/components/campo/ui";
import { hoyISO } from "@/lib/formato";
import { validarDatos } from "@/lib/offline/esquemas";
import { formatoNumero } from "@/lib/offline/resumen";
import type { AnimalCatalogo, Catalogo } from "@/lib/offline/tipos";
import { Chip, type Guardar } from "./formularios-rapidos";

type Jornada = "am" | "pm";
type Valores = Record<string, string>;

const claveBorrador = (finca: string, fecha: string, jornada: Jornada) => `vacdata:borrador:${finca}:${fecha}:${jornada}`;

function leerBorrador(clave: string): Valores {
  try {
    return JSON.parse(localStorage.getItem(clave) ?? "{}") as Valores;
  } catch {
    return {};
  }
}

function escribirBorrador(clave: string, valores: Valores) {
  try {
    if (Object.values(valores).some((v) => v.trim())) localStorage.setItem(clave, JSON.stringify(valores));
    else localStorage.removeItem(clave);
  } catch {
    // Sin almacenamiento: el borrador solo vive en pantalla.
  }
}

function aLitros(texto: string | undefined) {
  if (!texto?.trim()) return null;
  const n = Number(texto.replace(",", "."));
  return Number.isFinite(n) && n >= 0 && n <= 99 ? n : NaN;
}

const normalizar = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const porChapeta = (a: AnimalCatalogo, b: AnimalCatalogo) => (a.chapeta ?? a.codigo).localeCompare(b.chapeta ?? b.codigo, "es", { numeric: true });

export function OrdenoLista({ catalogo, alGuardar }: { catalogo: Catalogo; alGuardar: Guardar }) {
  const [turno, setTurno] = useState(() => {
    const fecha = hoyISO();
    const jornada: Jornada = new Date().getHours() < 12 ? "am" : "pm";
    const clave = claveBorrador(catalogo.finca_id, fecha, jornada);
    return { fecha, jornada, clave, valores: leerBorrador(clave) };
  });
  const [todas, setTodas] = useState(false);
  const [filtro, setFiltro] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const entradas = useRef<(HTMLInputElement | null)[]>([]);
  const botonGuardar = useRef<HTMLButtonElement>(null);

  const vacas = useMemo(
    () => catalogo.animales.filter((a) => (todas ? a.sexo === "hembra" && ["vaca", "novilla"].includes(a.categoria) : a.en_ordeno)).sort(porChapeta),
    [catalogo, todas],
  );
  const visibles = useMemo(() => {
    const t = normalizar(filtro.trim());
    return t ? vacas.filter((a) => normalizar(`${a.chapeta ?? ""} ${a.codigo} ${a.nombre}`).includes(t)) : vacas;
  }, [vacas, filtro]);

  const { valores, fecha, jornada } = turno;
  const litros = vacas.map((a) => aLitros(valores[a.id]));
  const anotadas = litros.filter((l): l is number => l !== null && !Number.isNaN(l));
  const invalidas = litros.filter((l) => Number.isNaN(l)).length;
  const total = anotadas.reduce((s, l) => s + l, 0);

  function cambiarTurno(nuevaFecha: string, nuevaJornada: Jornada) {
    const clave = claveBorrador(catalogo.finca_id, nuevaFecha, nuevaJornada);
    setTurno({ fecha: nuevaFecha, jornada: nuevaJornada, clave, valores: leerBorrador(clave) });
  }

  function anotar(id: string, valor: string) {
    const nuevos = { ...valores, [id]: valor };
    setTurno({ ...turno, valores: nuevos });
    escribirBorrador(turno.clave, nuevos);
  }

  function siguiente(e: KeyboardEvent<HTMLInputElement>, i: number) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const proxima = entradas.current[i + 1];
    if (proxima) {
      proxima.focus();
      proxima.select();
    } else botonGuardar.current?.focus();
  }

  async function guardar() {
    const items = vacas.flatMap((a, i) => (litros[i] !== null && !Number.isNaN(litros[i]) ? [{ animal_id: a.id, litros: litros[i] }] : []));
    if (invalidas) return setError("Hay litros que no son válidos (entre 0 y 99). Están marcados en rojo.");
    if (!items.length) return setError("Anota los litros de al menos una vaca.");
    const faltan = vacas.length - items.length;
    if (faltan > 0 && !window.confirm(`Faltan ${faltan} vacas sin litros. ¿Guardar solo las ${items.length} anotadas?`)) return;

    const leido = validarDatos("ordeno_lista", { fecha, jornada, items });
    if (!leido.ok) return setError(leido.mensaje);
    setGuardando(true);
    try {
      await alGuardar("ordeno_lista", leido.datos);
      setError(null);
      escribirBorrador(turno.clave, {});
      setTurno({ ...turno, valores: {} });
      setFiltro("");
    } catch {
      setError("No se pudo guardar en el teléfono. Revisa que haya espacio disponible.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-xl font-bold text-slate-900">Ordeño por lista</h2>
        <p className="text-sm text-slate-500">Anota los litros de cada vaca y pasa a la siguiente con Enter / Siguiente. Lo escrito no se pierde si cierras la app.</p>
      </div>

      <div className="grid grid-cols-[1fr_auto] items-end gap-3">
        <label className="block">
          <span className="mb-2 block font-bold text-slate-800">Fecha</span>
          <input type="date" value={fecha} max={hoyISO()} onChange={(e) => e.target.value && cambiarTurno(e.target.value, jornada)} className={control} />
        </label>
        <div className="flex gap-2 pb-1.5">
          {(["am", "pm"] as const).map((j) => (
            <Chip key={j} activo={jornada === j} onClick={() => cambiarTurno(fecha, j)}>
              {j.toUpperCase()}
            </Chip>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <label className="relative flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" aria-hidden />
          <span className="sr-only">Buscar vaca en la lista</span>
          <input value={filtro} onChange={(e) => setFiltro(e.target.value)} placeholder="Buscar en la lista" className={`${control} pl-12`} />
        </label>
        <Chip activo={todas} onClick={() => setTodas(!todas)}>
          Todas
        </Chip>
      </div>

      {vacas.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-300 p-5 text-center text-slate-500">
          No hay vacas en ordeño en los datos descargados. Toca «Todas» para ver todas las vacas y novillas.
        </p>
      ) : (
        <ol className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200">
          {visibles.map((a, i) => {
            const valor = valores[a.id] ?? "";
            const invalido = Number.isNaN(aLitros(valor));
            const anterior = jornada === "am" ? a.litros_am : a.litros_pm;
            return (
              <li key={a.id} className={clsx("flex items-center gap-3 px-3 py-2", valor.trim() && !invalido && "bg-emerald-50/60")}>
                <label htmlFor={`litros-${a.id}`} className="min-w-0 flex-1">
                  <span className="block text-lg font-bold leading-tight text-slate-900">{a.chapeta ?? a.codigo}</span>
                  <span className="block truncate text-sm text-slate-500">
                    {a.nombre}
                    {anterior != null && <span className="text-slate-400"> · antes {formatoNumero(anterior)} L</span>}
                  </span>
                </label>
                <input
                  id={`litros-${a.id}`}
                  ref={(el) => {
                    entradas.current[i] = el;
                  }}
                  value={valor}
                  onChange={(e) => anotar(a.id, e.target.value)}
                  onKeyDown={(e) => siguiente(e, i)}
                  onFocus={(e) => e.target.select()}
                  inputMode="decimal"
                  enterKeyHint={i === visibles.length - 1 ? "done" : "next"}
                  autoComplete="off"
                  placeholder="L"
                  aria-invalid={invalido}
                  className={clsx(
                    "h-14 w-24 rounded-xl border bg-white px-3 text-right text-2xl font-bold text-slate-900 focus:outline-none focus:ring-4",
                    invalido ? "border-red-400 ring-red-200" : "border-slate-300 focus:border-campo focus:ring-campo/15",
                  )}
                />
              </li>
            );
          })}
        </ol>
      )}

      <div className="sticky bottom-24 z-10 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur">
        <p className="mb-2 flex justify-between text-sm font-bold text-slate-700">
          <span>
            {anotadas.length} de {vacas.length} vacas
          </span>
          <span className="text-lg text-slate-900">Total {formatoNumero(total)} L</span>
        </p>
        {error && (
          <p role="alert" className="mb-2 rounded-xl bg-red-50 p-2 text-sm font-semibold text-red-800">
            {error}
          </p>
        )}
        <button
          ref={botonGuardar}
          type="button"
          onClick={guardar}
          disabled={guardando}
          className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-campo text-lg font-bold text-white disabled:opacity-60"
        >
          <Save className="h-5 w-5" aria-hidden />
          {guardando ? "Guardando…" : `Guardar ordeño ${jornada.toUpperCase()}`}
        </button>
      </div>
    </div>
  );
}
