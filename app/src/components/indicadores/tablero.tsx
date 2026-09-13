import Link from "next/link";
import clsx from "clsx";
import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";
import { calcularInforme, type ParametrosCostos } from "@/lib/finanzas";
import { Tarjeta, TituloTarjeta, Vacio } from "@/components/ui";
import { mesCorto } from "@/components/inventario/comun";
import { formatear, type Formato } from "./formato";
import { GraficaBarras, GraficaLineas, type Punto } from "./graficas";

export type MesIndicadores = {
  mes: string;
  litros_totales: number;
  dias_con_ordeno: number;
  litros_dia: number | null;
  vacas_ordeno_promedio: number | null;
  litros_vaca_dia: number | null;
  recogido_litros: number;
  partos: number;
  servicios: number;
  palpaciones: number;
  prenadas_confirmadas: number;
  tasa_concepcion: number | null;
  prenez_hato: number | null;
  dias_abiertos_promedio: number | null;
  costo_litro: number | null;
  precio_litro: number | null;
};

type Clave = Exclude<keyof MesIndicadores, "mes">;

type Props = {
  fincaId: string;
  meses: MesIndicadores[];
};

const COLORES = { bosque: "#1d5136", pasto: "#8fbf55", dorado: "#e0a82e", cafe: "#9b653c", campo: "#2563eb", alerta: "#a53b2b" };

/** Valores con dato, en orden cronológico. */
function conDato(meses: MesIndicadores[], clave: Clave) {
  return meses.filter((m) => m[clave] != null).map((m) => ({ mes: m.mes, valor: Number(m[clave]) }));
}

function tendencia(meses: MesIndicadores[], clave: Clave, sujeto: string, formato: Formato) {
  const serie = conDato(meses, clave);
  if (serie.length === 0) return `Todavía no hay datos para calcular ${sujeto.toLowerCase().replace(/^(el|la|los|las) /, "")} en este rango.`;
  const ultimo = serie.at(-1)!;
  if (serie.length === 1) return `${sujeto} fue de ${formatear(ultimo.valor, formato)} en ${mesCorto(ultimo.mes)}; es el único mes con datos.`;
  const primero = serie[0];
  const [a, b] = [formatear(primero.valor, formato), formatear(ultimo.valor, formato)];
  if (a === b) return `${sujeto} se mantuvo en ${b} entre ${mesCorto(primero.mes)} y ${mesCorto(ultimo.mes)}.`;
  return `${sujeto} ${ultimo.valor > primero.valor ? "subió" : "bajó"} de ${a} en ${mesCorto(primero.mes)} a ${b} en ${mesCorto(ultimo.mes)}.`;
}

const KPIS: { clave: Clave; etiqueta: string; formato: Formato; menosEsMejor?: boolean }[] = [
  { clave: "litros_dia", etiqueta: "Litros por día", formato: "litros" },
  { clave: "litros_vaca_dia", etiqueta: "Litros por vaca al día", formato: "litros" },
  { clave: "vacas_ordeno_promedio", etiqueta: "Vacas en ordeño (promedio)", formato: "numero" },
  { clave: "prenez_hato", etiqueta: "Preñez del hato", formato: "pct" },
  { clave: "tasa_concepcion", etiqueta: "Tasa de concepción", formato: "pct" },
  { clave: "dias_abiertos_promedio", etiqueta: "Días abiertos promedio", formato: "dias", menosEsMejor: true },
];

export function TableroIndicadores({ fincaId, meses }: Props) {
  const punto = (m: MesIndicadores, extra: Record<string, number | null>): Punto => ({ etiqueta: mesCorto(m.mes), ...extra });
  const hayOrdeno = (m: MesIndicadores) => m.dias_con_ordeno > 0;

  const litrosDia = meses.map((m) => punto(m, { litros_dia: m.litros_dia }));
  const litrosVaca = meses.map((m) => punto(m, { litros_vaca_dia: m.litros_vaca_dia, vacas: m.vacas_ordeno_promedio }));
  const reproduccion = meses.map((m) => punto(m, { prenez_hato: m.prenez_hato, tasa_concepcion: m.tasa_concepcion }));
  const eventos = meses.map((m) => punto(m, { partos: m.partos, servicios: m.servicios }));
  const leche = meses.map((m) =>
    punto(m, {
      ordenado: hayOrdeno(m) ? m.litros_totales : null,
      recogido: m.recogido_litros > 0 ? m.recogido_litros : null,
    }),
  );
  const costos = meses.map((m) => punto(m, { costo: m.costo_litro, precio: m.precio_litro }));

  const totalPartos = meses.reduce((s, m) => s + m.partos, 0);
  const totalServicios = meses.reduce((s, m) => s + m.servicios, 0);
  const masServicios = [...meses].sort((a, b) => b.servicios - a.servicios)[0];
  const ultimoLeche = [...meses].reverse().find((m) => hayOrdeno(m) && m.recogido_litros > 0);
  const ultimoCosto = [...meses].reverse().find((m) => m.costo_litro != null);
  const mejorMes = conDato(meses, "litros_dia").sort((a, b) => b.valor - a.valor)[0];

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {KPIS.map((k) => (
          <Kpi key={k.clave} {...k} serie={conDato(meses, k.clave)} />
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Grafica
          titulo="Litros por día"
          vacio={!meses.some(hayOrdeno)}
          vacioTexto="No hay ordeños registrados en este rango."
          nota={`${tendencia(meses, "litros_dia", "La producción diaria", "litros")}${mejorMes && conDato(meses, "litros_dia").length > 1 ? ` El mejor mes fue ${mesCorto(mejorMes.mes)}.` : ""}`}
        >
          <GraficaLineas datos={litrosDia} formato="litros" series={[{ clave: "litros_dia", nombre: "Litros por día", color: COLORES.bosque }]} />
        </Grafica>

        <Grafica
          titulo="Litros por vaca"
          vacio={!meses.some(hayOrdeno)}
          vacioTexto="No hay ordeños registrados en este rango."
          nota={tendencia(meses, "litros_vaca_dia", "El promedio por vaca", "litros")}
        >
          <GraficaLineas datos={litrosVaca} formato="litros" series={[{ clave: "litros_vaca_dia", nombre: "Litros por vaca/día", color: COLORES.pasto }]} />
        </Grafica>

        <Grafica
          titulo="Preñez del hato y tasa de concepción"
          vacio={!meses.some((m) => m.prenez_hato != null || m.tasa_concepcion != null)}
          vacioTexto="No hay vacas paridas ni palpaciones en este rango."
          nota={`${tendencia(meses, "prenez_hato", "La preñez del hato", "pct")} ${tendencia(meses, "tasa_concepcion", "La tasa de concepción", "pct")}`}
        >
          <GraficaLineas
            datos={reproduccion}
            formato="pct"
            series={[
              { clave: "prenez_hato", nombre: "% preñez del hato", color: COLORES.bosque },
              { clave: "tasa_concepcion", nombre: "Tasa de concepción", color: COLORES.dorado },
            ]}
          />
        </Grafica>

        <Grafica
          titulo="Partos y servicios"
          vacio={totalPartos + totalServicios === 0}
          vacioTexto="No hay partos ni servicios registrados en este rango."
          nota={`En estos ${meses.length} meses hubo ${totalPartos} ${totalPartos === 1 ? "parto" : "partos"} y ${totalServicios} ${totalServicios === 1 ? "servicio" : "servicios"}.${
            masServicios?.servicios ? ` El mes con más servicios fue ${mesCorto(masServicios.mes)} (${masServicios.servicios}).` : ""
          }`}
        >
          <GraficaBarras
            datos={eventos}
            formato="numero"
            series={[
              { clave: "partos", nombre: "Partos", color: COLORES.cafe },
              { clave: "servicios", nombre: "Servicios", color: COLORES.pasto },
            ]}
          />
        </Grafica>

        <Grafica
          titulo="Leche ordeñada y recogida por el carro tanque"
          vacio={!meses.some((m) => hayOrdeno(m) || m.recogido_litros > 0)}
          vacioTexto="No hay ordeños ni recolecciones registradas en este rango."
          nota={
            ultimoLeche
              ? `En ${mesCorto(ultimoLeche.mes)} el carro tanque recogió ${formatear(ultimoLeche.recogido_litros, "litros")} de ${formatear(ultimoLeche.litros_totales, "litros")} ordeñados (${formatear(ultimoLeche.recogido_litros / ultimoLeche.litros_totales, "pct")}). La diferencia es leche para terneras, consumo de la finca, descarte o recolecciones sin registrar.`
              : "Todavía no hay un mes con ordeños y recolecciones registrados a la vez, así que no se pueden comparar."
          }
        >
          <GraficaBarras
            datos={leche}
            formato="litros"
            series={[
              { clave: "ordenado", nombre: "Ordeñado", color: COLORES.bosque },
              { clave: "recogido", nombre: "Recogido", color: COLORES.campo },
            ]}
          />
        </Grafica>

        <Grafica
          titulo="Costo por litro"
          vacio={!ultimoCosto}
          vacioTexto={
            <>
              Sin parámetros de costos en este rango.{" "}
              <Link href={`/fincas/${fincaId}/costos`} className="font-bold text-bosque underline">
                Cargar parámetros de costos
              </Link>
            </>
          }
          nota={
            ultimoCosto
              ? `En ${mesCorto(ultimoCosto.mes)} producir un litro costó ${formatear(ultimoCosto.costo_litro, "pesos")} y se vendió a ${formatear(ultimoCosto.precio_litro, "pesos")}: ${
                  Number(ultimoCosto.precio_litro) >= Number(ultimoCosto.costo_litro) ? "utilidad" : "pérdida"
                } de ${formatear(Math.abs(Number(ultimoCosto.precio_litro) - Number(ultimoCosto.costo_litro)), "pesos")} por litro. Los meses sin parámetros quedan en blanco.`
              : undefined
          }
        >
          <GraficaLineas
            datos={costos}
            formato="pesos"
            series={[
              { clave: "costo", nombre: "Costo por litro", color: COLORES.alerta },
              { clave: "precio", nombre: "Precio de venta", color: COLORES.pasto },
            ]}
          />
        </Grafica>
      </div>
    </div>
  );
}

function Kpi({ etiqueta, formato, menosEsMejor, serie }: (typeof KPIS)[number] & { serie: { mes: string; valor: number }[] }) {
  const actual = serie.at(-1);
  const anterior = serie.at(-2);

  let cambio: string | null = null;
  let direccion = 0;
  if (actual && anterior) {
    const diferencia = actual.valor - anterior.valor;
    direccion = Math.abs(diferencia) < 1e-9 ? 0 : Math.sign(diferencia);
    if (formato === "pct") {
      cambio = `${diferencia >= 0 ? "+" : "−"}${formatear(Math.abs(diferencia) * 100, "numero")} pts`;
    } else if (anterior.valor !== 0) {
      cambio = `${diferencia >= 0 ? "+" : "−"}${formatear(Math.abs(diferencia / anterior.valor) * 100, "numero")} %`;
    }
  }
  const bueno = direccion === 0 ? null : (direccion > 0) !== !!menosEsMejor;
  const Flecha = direccion > 0 ? ArrowUpRight : direccion < 0 ? ArrowDownRight : ArrowRight;

  return (
    <div className="papel rounded-2xl p-4">
      <p className="text-sm font-bold text-tinta-suave">{etiqueta}</p>
      <p className="font-display mt-1 text-3xl font-bold text-bosque">{formatear(actual?.valor, formato)}</p>
      <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-tinta-suave">
        {actual ? <span className="font-bold capitalize">{mesCorto(actual.mes)}</span> : <span>Sin datos en el rango</span>}
        {anterior && (
          <span className={clsx("inline-flex items-center gap-0.5 font-bold", bueno === null ? "text-tinta-suave" : bueno ? "text-pasto-oscuro" : "text-alerta")}>
            <Flecha className="h-3.5 w-3.5" aria-hidden />
            {cambio ?? "—"} vs {mesCorto(anterior.mes)} ({formatear(anterior.valor, formato)})
          </span>
        )}
        {actual && !anterior && <span>· sin mes anterior para comparar</span>}
      </p>
    </div>
  );
}

function Grafica({
  titulo,
  nota,
  vacio,
  vacioTexto,
  children,
}: {
  titulo: string;
  nota?: string;
  vacio: boolean;
  vacioTexto: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Tarjeta className="break-inside-avoid">
      <TituloTarjeta>{titulo}</TituloTarjeta>
      {vacio ? (
        <Vacio>{vacioTexto}</Vacio>
      ) : (
        <>
          {children}
          {nota && <p className="mt-3 rounded-xl bg-lima-suave px-3 py-2 text-sm text-bosque">{nota}</p>}
        </>
      )}
    </Tarjeta>
  );
}

/** Une filas de indicadores_mensuales con el costo por litro de los parámetros de cada mes. */
export function armarMeses(
  filas: Record<string, unknown>[],
  parametros: { periodo: string; datos: unknown }[],
): MesIndicadores[] {
  const porMes = new Map(parametros.map((p) => [p.periodo.slice(0, 7), calcularInforme(p.datos as ParametrosCostos)]));
  const n = (v: unknown) => (v == null ? null : Number(v));
  return filas.map((f) => {
    const mes = String(f.mes);
    const informe = porMes.get(mes.slice(0, 7));
    return {
      mes,
      litros_totales: Number(f.litros_totales ?? 0),
      dias_con_ordeno: Number(f.dias_con_ordeno ?? 0),
      litros_dia: n(f.litros_dia),
      vacas_ordeno_promedio: n(f.vacas_ordeno_promedio),
      litros_vaca_dia: n(f.litros_vaca_dia),
      recogido_litros: Number(f.recogido_litros ?? 0),
      partos: Number(f.partos ?? 0),
      servicios: Number(f.servicios ?? 0),
      palpaciones: Number(f.palpaciones ?? 0),
      prenadas_confirmadas: Number(f.prenadas_confirmadas ?? 0),
      tasa_concepcion: n(f.tasa_concepcion),
      prenez_hato: n(f.prenez_hato),
      dias_abiertos_promedio: n(f.dias_abiertos_promedio),
      costo_litro: informe && informe.costoLitro > 0 ? informe.costoLitro : null,
      precio_litro: informe ? informe.precio : null,
    };
  });
}
