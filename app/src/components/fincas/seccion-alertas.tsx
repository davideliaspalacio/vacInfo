import Link from "next/link";
import type { Database } from "@/lib/database.types";
import { fecha } from "@/lib/formato";
import { Etiqueta, Tarjeta, TituloTarjeta, Vacio } from "@/components/ui";
import { TIPOS_ALERTA, URGENCIAS } from "@/components/fincas/etiquetas";

type Alerta = Database["public"]["Functions"]["alertas_finca"]["Returns"][number];

export function SeccionAlertas({ alertas, corte }: { alertas: Alerta[]; corte: string }) {
  return (
    <Tarjeta>
      <TituloTarjeta detalle={`Próximos 7 días desde el ${fecha(corte)}`}>Alertas</TituloTarjeta>
      {alertas.length === 0 ? (
        <Vacio>No hay alertas para esta fecha. ¡Todo al día!</Vacio>
      ) : (
        <ul className="divide-y divide-black/5">
          {alertas.map((a, i) => {
            const urgencia = URGENCIAS[a.prioridad];
            const vencida = a.fecha < corte;
            return (
              <li key={`${a.tipo}-${a.animal_id}-${i}`} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:gap-4">
                <div className="flex w-44 shrink-0 items-center gap-2">
                  <Etiqueta tono={urgencia.tono}>{urgencia.texto}</Etiqueta>
                  <span className="text-sm font-bold text-bosque">{TIPOS_ALERTA[a.tipo] ?? a.tipo}</span>
                </div>
                <div className="flex-1">
                  <Link href={`/animales/${a.animal_id}`} className="font-bold text-bosque hover:underline">
                    {a.nombre}
                  </Link>
                  {a.chapeta && <span className="font-mono text-sm text-tinta-suave"> · {a.chapeta}</span>}
                  <p className="text-sm text-tinta-suave">{a.detalle}</p>
                </div>
                <span className={`text-sm font-bold ${vencida ? "text-alerta" : "text-tinta-suave"}`}>
                  {vencida ? "Vencida " : ""}
                  {fecha(a.fecha)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Tarjeta>
  );
}
