import Link from "next/link";
import clsx from "clsx";
import { BarChart3, ClipboardList, Landmark } from "lucide-react";

export const PESTANAS = [
  { id: "operativo", etiqueta: "Operativo", icono: ClipboardList },
  { id: "administrativo", etiqueta: "Administrativo", icono: BarChart3 },
  { id: "contable", etiqueta: "Contable", icono: Landmark },
] as const;

export type Pestana = (typeof PESTANAS)[number]["id"];

type Props = {
  fincas: { id: string; nombre: string }[];
  fincaId: string;
  desde: string;
  hasta: string;
  pestana: Pestana;
};

export function FiltrosInforme({ fincas, fincaId, desde, hasta, pestana }: Props) {
  return (
    <form action="/informes" className="papel flex flex-wrap items-end gap-3 rounded-2xl p-4 print:hidden">
      <input type="hidden" name="tab" value={pestana} />
      <label className="text-sm font-bold text-bosque">
        Finca
        <select name="finca" defaultValue={fincaId} className="campo-control mt-1 min-w-44">
          {fincas.map((f) => (
            <option key={f.id} value={f.id}>
              {f.nombre}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm font-bold text-bosque">
        Desde
        <input type="date" name="desde" defaultValue={desde} max={hasta} className="campo-control mt-1" />
      </label>
      <label className="text-sm font-bold text-bosque">
        Hasta
        <input type="date" name="hasta" defaultValue={hasta} className="campo-control mt-1" />
      </label>
      <button className="boton-accion rounded-xl bg-lima px-4 py-3 font-bold text-bosque">Aplicar fechas</button>
    </form>
  );
}

export function PestanasInforme({ fincaId, desde, hasta, pestana }: Omit<Props, "fincas">) {
  return (
    <nav aria-label="Tipo de informe" className="flex flex-wrap gap-3 print:hidden">
      {PESTANAS.map(({ id, etiqueta, icono: Icono }) => {
        const activa = id === pestana;
        const params = new URLSearchParams({ finca: fincaId, desde, hasta, tab: id });
        return (
          <Link
            key={id}
            href={`/informes?${params}`}
            aria-current={activa ? "page" : undefined}
            className={clsx(
              "boton-accion inline-flex items-center gap-2 rounded-xl px-5 py-3 font-bold",
              activa ? "bg-lima text-bosque" : "bg-leche/90 text-tinta-suave hover:text-bosque",
            )}
          >
            <Icono className="h-4 w-4" aria-hidden />
            {etiqueta}
          </Link>
        );
      })}
    </nav>
  );
}
