import Link from "next/link";
import { X } from "lucide-react";
import { BotonGuardar } from "./boton-guardar";
import { TarjetaCampo } from "./ui";

export function Formulario({
  titulo,
  descripcion,
  accion,
  volver,
  paso,
  boton,
  antes,
  children,
}: {
  titulo: string;
  descripcion?: string;
  accion: (formData: FormData) => Promise<void>;
  /** Ruta a la que se vuelve al guardar. */
  volver: string;
  /** Parámetros que reabren este formulario si hay un error, p. ej. "accion=ordeno". */
  paso: string;
  boton?: string;
  /** Contenido fuera del <form>, como selectores de subtipo. */
  antes?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <TarjetaCampo>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-bold text-slate-900">{titulo}</h2>
          {descripcion && <p className="mt-1 text-slate-600">{descripcion}</p>}
        </div>
        <Link href={volver} aria-label="Cancelar" className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-600">
          <X className="h-5 w-5" aria-hidden />
        </Link>
      </div>
      {antes}
      <form action={accion} className="space-y-4">
        <input type="hidden" name="volver" value={volver} />
        <input type="hidden" name="paso" value={paso} />
        {children}
        <div className="pt-2">
          <BotonGuardar>{boton}</BotonGuardar>
        </div>
      </form>
    </TarjetaCampo>
  );
}
