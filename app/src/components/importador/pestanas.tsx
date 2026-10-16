import Link from "next/link";
import clsx from "clsx";
import { FileSpreadsheet, PawPrint } from "lucide-react";

export const PESTANAS = [
  { id: "quincenal", etiqueta: "Planilla quincenal", icono: FileSpreadsheet },
  { id: "seres-vivos", etiqueta: "Seres vivos", icono: PawPrint },
] as const;

export type PestanaImportador = (typeof PESTANAS)[number]["id"];

/** Pestaña pedida en la URL (`?tab=`); por defecto la planilla quincenal. */
export function pestanaDe(valor: string | string[] | undefined): PestanaImportador {
  return PESTANAS.some((p) => p.id === valor) ? (valor as PestanaImportador) : "quincenal";
}

export function PestanasImportador({ activa, fincaId }: { activa: PestanaImportador; fincaId: string }) {
  return (
    <nav aria-label="Tipo de planilla" className="flex flex-wrap gap-3">
      {PESTANAS.map(({ id, etiqueta, icono: Icono }) => {
        const esActiva = id === activa;
        const params = new URLSearchParams({ tab: id, ...(fincaId ? { finca: fincaId } : {}) });
        return (
          <Link
            key={id}
            href={`/importar?${params}`}
            aria-current={esActiva ? "page" : undefined}
            className={clsx(
              "boton-accion inline-flex items-center gap-2 rounded-xl px-5 py-3 font-bold",
              esActiva ? "bg-lima text-bosque" : "bg-leche/90 text-tinta-suave hover:text-bosque",
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
