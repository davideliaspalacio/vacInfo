import { obtenerSesion } from "@/lib/sesion";
import { corteDeFinca } from "@/lib/datos";
import { fecha, hoyISO } from "@/lib/formato";
import { leerRangoMeses, sumarMeses, type Atajo } from "@/lib/rango";
import { Encabezado, Tarjeta, Vacio } from "@/components/ui";
import { RangoFechas } from "@/components/rango-fechas";
import { fincaElegida, mesLargo, uno } from "@/components/inventario/comun";
import { armarMeses, TableroIndicadores } from "@/components/indicadores/tablero";

export const metadata = { title: "Indicadores" };

const RANGOS = [6, 12, 24] as const;
const MAXIMO_MESES = 36;

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
  const corte = await corteDeFinca(supabase, finca.id);
  // ?desde=YYYY-MM&hasta=YYYY-MM; ?meses=6|12|24 (enlaces viejos) sigue sirviendo como atajo.
  const rango = leerRangoMeses(sp, corte, hoyISO(), { maximo: MAXIMO_MESES });
  const { desdeMes, hastaMes, pDesde, pHasta } = rango;

  const [{ data: filas, error }, { data: parametros }] = await Promise.all([
    supabase.rpc("indicadores_mensuales", { p_finca: finca.id, p_desde: pDesde, p_hasta: pHasta }),
    supabase.from("parametros_costos").select("periodo, datos").eq("finca_id", finca.id).gte("periodo", pDesde).lte("periodo", pHasta).order("periodo"),
  ]);

  const datos = armarMeses(filas ?? [], parametros ?? []);

  const mesCorte = corte.slice(0, 7);
  const atajo = (clave: string, texto: string, desde: string, hasta: string): Atajo => ({
    clave,
    texto,
    desde,
    hasta,
    activo: desde === desdeMes && hasta === hastaMes,
  });
  const anioCorte = mesCorte.slice(0, 4);
  const atajos = [
    ...RANGOS.map((r) => atajo(`${r}m`, `${r} meses`, sumarMeses(mesCorte, -(r - 1)), mesCorte)),
    atajo("anio", "Este año", `${anioCorte}-01`, mesCorte),
    atajo("anio-anterior", "Año anterior", `${Number(anioCorte) - 1}-01`, `${Number(anioCorte) - 1}-12`),
  ];

  return (
    <div className="space-y-6">
      <Encabezado
        eyebrow={`Indicadores · ${finca.nombre}`}
        titulo="Tablero de indicadores"
        descripcion={`Mes a mes, de ${mesLargo(pDesde)} a ${mesLargo(pHasta)}. ${
          pHasta === corte
            ? `El último mes llega hasta el ${fecha(corte, true)}, la fecha de los últimos ordeños registrados.`
            : `El último mes llega hasta el ${fecha(pHasta, true)}.`
        }`}
      />

      <div className="papel space-y-4 rounded-2xl p-4">
        <form action="/indicadores" className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="desde" value={desdeMes} />
          <input type="hidden" name="hasta" value={hastaMes} />
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
        <RangoFechas
          ruta="/indicadores"
          searchParams={sp}
          tipo="month"
          desde={desdeMes}
          hasta={hastaMes}
          texto={`De ${mesLargo(pDesde)} a ${mesLargo(pHasta)} · ${rango.meses} ${rango.meses === 1 ? "mes" : "meses"}`}
          atajos={atajos}
          nota={
            <>
              Elige el mes inicial y el final.
              {rango.recortado && ` El rango se recortó a los últimos ${MAXIMO_MESES} meses.`}
              {mesCorte < hoyISO().slice(0, 7) && ` Los atajos cuentan hasta ${mesLargo(corte)}, el mes de los últimos ordeños registrados.`}
            </>
          }
          className="border-t border-black/10 pt-4"
        />
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
