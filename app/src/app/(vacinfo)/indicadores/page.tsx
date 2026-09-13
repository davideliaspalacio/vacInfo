import Link from "next/link";
import clsx from "clsx";
import { obtenerSesion } from "@/lib/sesion";
import { corteDeFinca } from "@/lib/datos";
import { fecha } from "@/lib/formato";
import { Encabezado, Tarjeta, Vacio } from "@/components/ui";
import { fincaElegida, mesLargo, sumarMeses, uno } from "@/components/inventario/comun";
import { armarMeses, TableroIndicadores } from "@/components/indicadores/tablero";

export const metadata = { title: "Indicadores" };

const RANGOS = [6, 12, 24] as const;

export default async function IndicadoresPage(props: PageProps<"/indicadores">) {
  const sp = await props.searchParams;
  const sesion = await obtenerSesion();
  const { supabase, fincas } = sesion;

  if (fincas.length === 0) {
    return (
      <div className="space-y-6">
        <Encabezado eyebrow="Indicadores" titulo="Tablero de indicadores" />
        <Tarjeta>
          <Vacio>Tu organización todavía no tiene fincas registradas.</Vacio>
        </Tarjeta>
      </div>
    );
  }

  const finca = await fincaElegida(sesion, uno(sp.finca));
  const pedido = Number(uno(sp.meses));
  const meses = RANGOS.find((r) => r === pedido) ?? 12;

  const corte = await corteDeFinca(supabase, finca.id);
  const desde = `${sumarMeses(corte.slice(0, 7), -(meses - 1))}-01`;

  const [{ data: filas, error }, { data: parametros }] = await Promise.all([
    supabase.rpc("indicadores_mensuales", { p_finca: finca.id, p_desde: desde, p_hasta: corte }),
    supabase.from("parametros_costos").select("periodo, datos").eq("finca_id", finca.id).gte("periodo", desde).lte("periodo", corte).order("periodo"),
  ]);

  const datos = armarMeses(filas ?? [], parametros ?? []);

  return (
    <div className="space-y-6">
      <Encabezado
        eyebrow={`Indicadores · ${finca.nombre}`}
        titulo="Tablero de indicadores"
        descripcion={`Mes a mes, de ${mesLargo(desde)} a ${mesLargo(corte)}. El último mes llega hasta el ${fecha(corte, true)}, la fecha de los últimos ordeños registrados.`}
      />

      <div className="papel flex flex-wrap items-end justify-between gap-3 rounded-2xl p-4">
        <form action="/indicadores" className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="meses" value={meses} />
          <label className="text-sm font-bold text-bosque">
            Finca
            <select name="finca" defaultValue={finca.id} className="campo-control mt-1 min-w-44">
              {fincas.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nombre}
                </option>
              ))}
            </select>
          </label>
          <button className="boton-accion rounded-xl bg-lima px-4 py-3 font-bold text-bosque">Ver finca</button>
        </form>
        <nav aria-label="Rango de meses" className="flex gap-2">
          {RANGOS.map((r) => (
            <Link
              key={r}
              href={`/indicadores?${new URLSearchParams({ finca: finca.id, meses: String(r) })}`}
              aria-current={r === meses ? "page" : undefined}
              className={clsx(
                "rounded-xl px-4 py-2.5 text-sm font-bold",
                r === meses ? "bg-bosque text-leche" : "border border-tinta/15 text-tinta-suave hover:bg-lima-suave hover:text-bosque",
              )}
            >
              {r} meses
            </Link>
          ))}
        </nav>
      </div>

      {error ? (
        <Tarjeta>
          <Vacio>No se pudieron calcular los indicadores: {error.message}</Vacio>
        </Tarjeta>
      ) : (
        <TableroIndicadores fincaId={finca.id} meses={datos} />
      )}
    </div>
  );
}
