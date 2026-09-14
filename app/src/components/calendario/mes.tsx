import Link from "next/link";
import clsx from "clsx";
import { Etiqueta } from "@/components/ui";
import { MESES_LARGOS } from "@/components/inventario/comun";
import { horaCorta } from "./programados";
import { claseEvento, etiquetaEvento, nombreAnimal, type Evento } from "./tipos";

const DIAS_SEMANA = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const DIAS_LARGOS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MAX_CHIPS = 3;

/** Enlace que abre el detalle de un evento programado. */
type EnlaceDetalle = (id: string) => string;

function agrupar(eventos: Evento[]) {
  const porDia = new Map<string, Evento[]>();
  for (const e of eventos) porDia.set(e.fecha, [...(porDia.get(e.fecha) ?? []), e]);
  return porDia;
}

function destino(e: Evento, dia: string, detalle: EnlaceDetalle) {
  if (e.id) return detalle(e.id);
  return e.animal_id ? `/animales/${e.animal_id}` : `#dia-${dia}`;
}

export function CuadriculaMes({ dias, mes, corte, eventos, detalle }: { dias: string[]; mes: string; corte: string; eventos: Evento[]; detalle: EnlaceDetalle }) {
  const porDia = agrupar(eventos);

  return (
    <div className="overflow-x-auto">
      <div className="grid min-w-[640px] grid-cols-7 overflow-hidden rounded-2xl border border-tinta/15 bg-white print:min-w-0">
        {DIAS_SEMANA.map((d) => (
          <div key={d} className="border-b border-tinta/15 bg-lima-suave px-2 py-1.5 text-center text-xs font-bold uppercase text-bosque">
            {d}
          </div>
        ))}
        {dias.map((dia, i) => {
          const delMes = dia.startsWith(mes);
          const lista = porDia.get(dia) ?? [];
          const esCorte = dia === corte;
          return (
            <div
              key={dia}
              className={clsx(
                "min-h-28 border-tinta/10 p-1.5",
                i % 7 !== 6 && "border-r",
                i < dias.length - 7 && "border-b",
                !delMes && "bg-black/[0.03]",
                esCorte && "relative ring-2 ring-inset ring-dorado bg-dorado/10",
              )}
            >
              <div className="mb-1 flex items-center justify-between gap-1">
                <span className={clsx("text-sm font-bold tabular-nums", delMes ? "text-bosque" : "text-tinta-suave/60")}>{Number(dia.slice(8))}</span>
                {esCorte && <span className="rounded bg-dorado px-1 text-[10px] font-bold uppercase text-bosque">Corte</span>}
              </div>
              <ul className="space-y-1">
                {lista.slice(0, MAX_CHIPS).map((e, j) => (
                  <li key={e.id ?? j}>
                    <Link
                      href={destino(e, dia, detalle)}
                      title={`${etiquetaEvento(e)} · ${e.id ? (e.detalle ?? "") : nombreAnimal(e)}${!e.id && e.detalle ? ` · ${e.detalle}` : ""}`}
                      className={clsx("block truncate rounded-md border px-1.5 py-0.5 text-[11px] font-bold leading-tight", claseEvento(e, corte), !delMes && "opacity-60")}
                    >
                      {etiquetaEvento(e)} · {e.id ? e.detalle : e.chapeta || e.nombre || ""}
                    </Link>
                  </li>
                ))}
                {lista.length > MAX_CHIPS && (
                  <li>
                    <Link href={`#dia-${dia}`} className="block rounded-md px-1.5 text-[11px] font-bold text-tinta-suave hover:bg-lima-suave hover:text-bosque">
                      +{lista.length - MAX_CHIPS} más
                    </Link>
                  </li>
                )}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EstadoAgenda({ e, corte }: { e: Evento; corte: string }) {
  if (e.estado === "cancelado") return <Etiqueta tono="gris">Cancelado</Etiqueta>;
  if (e.realizado) return <Etiqueta tono="verde">Hecho</Etiqueta>;
  if (e.fecha < corte) return <Etiqueta tono="rojo">Vencido</Etiqueta>;
  return <Etiqueta tono="azul">Programado</Etiqueta>;
}

export function AgendaMes({ mes, corte, eventos, detalle }: { mes: string; corte: string; eventos: Evento[]; detalle: EnlaceDetalle }) {
  const porDia = [...agrupar(eventos.filter((e) => e.fecha.startsWith(mes))).entries()].sort(([a], [b]) => a.localeCompare(b));

  if (porDia.length === 0) return <p className="rounded-2xl border border-dashed border-tinta/20 p-6 text-center text-tinta-suave">No hay eventos este mes con los filtros elegidos.</p>;

  return (
    <ol className="space-y-5">
      {porDia.map(([dia, lista]) => {
        const d = new Date(`${dia}T12:00:00Z`);
        return (
          <li key={dia} id={`dia-${dia}`} className="scroll-mt-24 break-inside-avoid">
            <h3 className={clsx("mb-2 flex items-baseline gap-2 border-b pb-1 font-display text-lg font-bold", dia === corte ? "border-dorado text-bosque" : "border-tinta/10 text-bosque")}>
              <span className="capitalize">{DIAS_LARGOS[d.getUTCDay()]}</span> {Number(dia.slice(8))} de {MESES_LARGOS[d.getUTCMonth()]}
              {dia === corte && <Etiqueta tono="amarillo">Día de corte</Etiqueta>}
              <span className="ml-auto text-sm font-normal text-tinta-suave">{lista.length} {lista.length === 1 ? "evento" : "eventos"}</span>
            </h3>
            <ul className="divide-y divide-tinta/5">
              {lista.map((e, j) => (
                <li key={e.id ?? j} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-1.5 text-sm">
                  <span className={clsx("inline-block w-32 shrink-0 truncate rounded-md border px-2 py-0.5 text-center text-xs font-bold", claseEvento(e, corte))}>
                    {etiquetaEvento(e)}
                  </span>
                  {e.id ? (
                    <>
                      <Link href={detalle(e.id)} className={clsx("font-bold text-bosque underline-offset-2 hover:underline", e.estado === "cancelado" && "line-through")}>
                        {horaCorta(e.hora) && <span className="font-normal text-tinta-suave">{horaCorta(e.hora)} · </span>}
                        {e.detalle}
                      </Link>
                      {e.animal_id && (
                        <Link href={`/animales/${e.animal_id}`} className="text-tinta-suave underline-offset-2 hover:underline">
                          {nombreAnimal(e)}
                          {e.chapeta && e.nombre && ` · ${e.chapeta}`}
                        </Link>
                      )}
                    </>
                  ) : (
                    <>
                      {e.animal_id ? (
                        <Link href={`/animales/${e.animal_id}`} className="font-bold text-bosque underline-offset-2 hover:underline">
                          {nombreAnimal(e)}
                          {e.chapeta && e.nombre && <span className="font-normal text-tinta-suave"> · {e.chapeta}</span>}
                        </Link>
                      ) : (
                        <span className="font-bold">{nombreAnimal(e)}</span>
                      )}
                      <span className="text-tinta-suave">{e.detalle}</span>
                    </>
                  )}
                  <span className="ml-auto">
                    <EstadoAgenda e={e} corte={corte} />
                  </span>
                </li>
              ))}
            </ul>
          </li>
        );
      })}
    </ol>
  );
}
