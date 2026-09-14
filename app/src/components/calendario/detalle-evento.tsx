import Link from "next/link";
import clsx from "clsx";
import { Ban, Check, RotateCcw, Trash2, X } from "lucide-react";
import { fecha } from "@/lib/formato";
import { Etiqueta, Tarjeta } from "@/components/ui";
import { cambiarEstadoEvento, eliminarEvento } from "@/app/(vacinfo)/calendario/actions";
import { etiquetaProgramado, horaCorta, type EventoProgramado } from "./programados";

const ESTADO = {
  pendiente: { tono: "azul", texto: "Pendiente" },
  hecho: { tono: "verde", texto: "Hecho" },
  cancelado: { tono: "gris", texto: "Cancelado" },
} as const;

type Props = {
  evento: EventoProgramado;
  corte: string;
  /** Vuelve al calendario con este detalle abierto */
  volver: string;
  /** Calendario sin detalle */
  cerrar: string;
  puedeEditar: boolean;
  puedeBorrar: boolean;
};

const BOTON = "inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-bold";

export function DetalleEvento({ evento, corte, volver, cerrar, puedeEditar, puedeBorrar }: Props) {
  const estado = ESTADO[evento.estado as keyof typeof ESTADO] ?? ESTADO.pendiente;
  const vencido = evento.estado === "pendiente" && evento.fecha < corte;
  const hora = horaCorta(evento.hora);

  const cambiar = (nuevo: keyof typeof ESTADO, texto: string, icono: React.ReactNode, clase: string) => (
    <form action={cambiarEstadoEvento}>
      <input type="hidden" name="id" value={evento.id} />
      <input type="hidden" name="estado" value={nuevo} />
      <input type="hidden" name="volver" value={volver} />
      <button className={clsx(BOTON, clase)}>
        {icono}
        {texto}
      </button>
    </form>
  );

  return (
    <Tarjeta id="evento" className="scroll-mt-24 border-2 border-dashed border-indigo-600/60 print:hidden">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-indigo-800">Evento programado · {etiquetaProgramado(evento.tipo)}</p>
          <h2 className="font-display text-2xl font-bold text-bosque">{evento.titulo}</h2>
          <div className="mt-2 flex flex-wrap gap-2">
            <Etiqueta tono={estado.tono}>{estado.texto}</Etiqueta>
            {vencido && <Etiqueta tono="rojo">Vencido</Etiqueta>}
          </div>
        </div>
        <Link href={cerrar} aria-label="Cerrar detalle" className="rounded-lg p-2 text-tinta-suave hover:bg-black/5">
          <X className="h-5 w-5" aria-hidden />
        </Link>
      </div>

      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-xs font-bold uppercase text-tinta-suave">Fecha</dt>
          <dd className="font-bold text-bosque">
            {fecha(evento.fecha, true)}
            {hora && ` · ${hora}`}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-bold uppercase text-tinta-suave">Animal</dt>
          <dd className="font-bold text-bosque">
            {evento.animal_id ? (
              <Link href={`/animales/${evento.animal_id}`} className="underline-offset-2 hover:underline">
                {evento.animales?.chapeta ? `${evento.animales.chapeta} · ` : ""}
                {evento.animales?.nombre ?? "Animal"}
              </Link>
            ) : (
              "Toda la finca"
            )}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-bold uppercase text-tinta-suave">Aviso en Mensajes</dt>
          <dd className="font-bold text-bosque">
            {evento.recordar_dias === 0 ? "El mismo día" : `${evento.recordar_dias} ${evento.recordar_dias === 1 ? "día" : "días"} antes`}
          </dd>
        </div>
      </dl>

      {evento.descripcion && <p className="mt-4 whitespace-pre-line rounded-xl bg-black/[0.03] p-3 text-sm">{evento.descripcion}</p>}

      {(puedeEditar || puedeBorrar) && (
        <div className="mt-4 flex flex-wrap gap-2 border-t border-tinta/10 pt-4">
          {puedeEditar && evento.estado !== "hecho" && cambiar("hecho", "Marcar hecho", <Check className="h-4 w-4" aria-hidden />, "bg-lima text-bosque")}
          {puedeEditar &&
            evento.estado !== "cancelado" &&
            cambiar("cancelado", "Cancelar", <Ban className="h-4 w-4" aria-hidden />, "border border-tinta/15 text-tinta-suave hover:bg-black/5")}
          {puedeEditar &&
            evento.estado !== "pendiente" &&
            cambiar("pendiente", "Volver a pendiente", <RotateCcw className="h-4 w-4" aria-hidden />, "border border-tinta/15 text-bosque hover:bg-lima-suave")}
          {puedeBorrar && (
            <form action={eliminarEvento} className="ml-auto">
              <input type="hidden" name="id" value={evento.id} />
              <input type="hidden" name="volver" value={cerrar} />
              <button className={clsx(BOTON, "text-alerta hover:bg-[#fbe9e5]")}>
                <Trash2 className="h-4 w-4" aria-hidden />
                Eliminar
              </button>
            </form>
          )}
        </div>
      )}
    </Tarjeta>
  );
}
