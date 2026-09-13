import Link from "next/link";
import clsx from "clsx";
import { calcularInforme, type Estado, type InformeContable as Informe, type ParametrosCostos } from "@/lib/finanzas";
import { fecha, litros, num, pct, pesos } from "@/lib/formato";
import { Etiqueta, Tarjeta, TituloTarjeta, Vacio } from "@/components/ui";
import { todasLasFilas, type PropsInforme } from "./consultas";
import { GraficaCostosPct, GraficaFlujoCaja, GraficaPagos } from "./graficas-contable";

const TONO_ESTADO: Record<Estado, "verde" | "amarillo" | "rojo"> = {
  RENTABLE: "verde",
  AJUSTADA: "amarillo",
  "EN RIESGO": "rojo",
};

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const nombrePeriodo = (iso: string) => `${MESES[Number(iso.slice(5, 7)) - 1]} de ${iso.slice(0, 4)}`;

export async function InformeContable({ supabase, rango, finca }: PropsInforme) {
  const { fincaId, desde, hasta } = rango;

  const [{ data: parametros }, { data: datosFinca }, ordenos] = await Promise.all([
    supabase
      .from("parametros_costos")
      .select("periodo, datos, registrado_en")
      .eq("finca_id", fincaId)
      .lte("periodo", hasta)
      .order("periodo", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from("fincas").select("nombre, departamento, municipio, vereda").eq("id", fincaId).single(),
    todasLasFilas((a, b) =>
      supabase
        .from("ordenos")
        .select("fecha, litros, animales!inner(finca_id)")
        .eq("animales.finca_id", fincaId)
        .gte("fecha", desde)
        .lte("fecha", hasta)
        .order("id")
        .range(a, b),
    ),
  ]);

  if (!parametros) {
    return (
      <Tarjeta>
        <TituloTarjeta>Informe contable · {finca.nombre}</TituloTarjeta>
        <Vacio>
          No hay parámetros de costos para un periodo anterior al {fecha(hasta, true)}.{" "}
          <Link href={`/fincas/${fincaId}/costos`} className="font-bold text-bosque underline">
            Cargar parámetros de costos
          </Link>
        </Vacio>
      </Tarjeta>
    );
  }

  const p = parametros.datos as unknown as ParametrosCostos;
  const r = calcularInforme(p);

  const litrosPorDia = new Map<string, number>();
  for (const o of ordenos) litrosPorDia.set(o.fecha, (litrosPorDia.get(o.fecha) ?? 0) + Number(o.litros));
  const realDia = litrosPorDia.size ? [...litrosPorDia.values()].reduce((s, v) => s + v, 0) / litrosPorDia.size : null;

  return (
    <div className="space-y-6">
      <Tarjeta className="print:rounded-none">
        <div className="border-b-[3px] border-bosque pb-4 text-center">
          <h2 className="font-display text-2xl font-bold uppercase text-bosque sm:text-3xl">Informe de ingresos y gastos – finca lechera</h2>
          <p className="mt-1 text-sm text-tinta-suave">
            Modelo de rentabilidad del consultor · parámetros de <strong className="capitalize">{nombrePeriodo(parametros.periodo)}</strong>
            {parametros.periodo.slice(0, 7) !== hasta.slice(0, 7) && " (último periodo cargado antes de la fecha de corte)"}
          </p>
        </div>
        <dl className="mt-4 grid gap-x-8 gap-y-1 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <Dato etiqueta="Nombre de la finca" valor={datosFinca?.nombre ?? finca.nombre} />
          <Dato etiqueta="Departamento" valor={datosFinca?.departamento ?? "—"} />
          <Dato etiqueta="Municipio" valor={datosFinca?.municipio ?? "—"} />
          <Dato etiqueta="Vereda" valor={datosFinca?.vereda ?? "—"} />
        </dl>

        <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_1.2fr_1fr]">
          <Bloque titulo="Datos generales" clase="bg-[#2336c9] text-white">
            <Filas
              filas={[
                ["Vacas en producción", num(p.animales.vacas_produccion)],
                ["Vacas horras - preparto", num(p.animales.vacas_horras)],
                ["Novillas", num(p.animales.novillas)],
                ["Terneronas", num(p.animales.terneronas)],
                ["Terneras", num(p.animales.terneras)],
                ["Toros", num(p.animales.toros)],
                ["Caballos", num(p.animales.caballos)],
                ["Perros", num(p.animales.perros)],
                ["Otros", num(p.animales.otros)],
              ]}
              total={["Total animales finca", num(r.totalAnimales)]}
            />
          </Bloque>
          <Bloque titulo="Resumen" clase="bg-dorado text-bosque">
            <Filas
              filas={[
                ["Producción día promedio", litros(r.litrosDia)],
                ["Promedio leche día por vaca", litros(r.promedioVaca)],
                ["Precio por litro venta", pesos(r.precio)],
                ["Costo por litro vendido", pesos(r.costoLitro)],
                ["Utilidad por litro", <Signo key="ul" v={r.utilidadLitro} texto={pesos(r.utilidadLitro)} />],
                ["Margen utilidad %", <Signo key="m" v={r.margen} texto={pct(r.margen)} />],
                ["Utilidad mensual producción", <Signo key="um" v={r.utilidadMes} texto={pesos(r.utilidadMes)} />],
                ["Valorización terneras y novillas", pesos(r.valorizacionMes)],
                ["Utilidad mensual total", <Signo key="ut" v={r.utilidadTotalMes} texto={pesos(r.utilidadTotalMes)} />],
              ]}
              total={["Margen utilidad % total", pct(r.margenTotal)]}
            />
          </Bloque>
          <Bloque titulo="Estado de rentabilidad" clase="bg-pasto text-bosque">
            <div className="space-y-3 p-3">
              <Semaforo titulo="Producción de leche" estado={r.estado} valor={r.margen} />
              <Semaforo titulo="Producción + levante" estado={r.estadoTotal} valor={r.margenTotal} />
              <Semaforo titulo="Flujo de caja" estado={r.caja.estado} valor={r.caja.margen} />
              <p className="rounded-xl bg-crema p-3 text-center text-sm font-bold italic text-bosque">
                No se trata de producir más leche. Se trata de ganar más dinero con la leche que se produce.
              </p>
            </div>
          </Bloque>
        </div>
      </Tarjeta>

      <Tarjeta>
        <TituloTarjeta detalle={realDia != null ? `${fecha(desde)} – ${fecha(hasta)}` : undefined}>Producción real del periodo</TituloTarjeta>
        {realDia == null ? (
          <Vacio>No hay ordeños registrados entre el {fecha(desde, true)} y el {fecha(hasta, true)}.</Vacio>
        ) : (
          <div className="grid gap-3 sm:grid-cols-4">
            <Cifra etiqueta="Litros/día registrados (ordeños)" valor={litros(realDia)} />
            <Cifra etiqueta="Litros/día del presupuesto" valor={litros(r.litrosDia)} />
            <Cifra
              etiqueta="Diferencia"
              valor={`${realDia - r.litrosDia > 0 ? "+" : ""}${litros(realDia - r.litrosDia)} (${pct(r.litrosDia ? (realDia - r.litrosDia) / r.litrosDia : 0)})`}
              alerta={realDia < r.litrosDia}
            />
            <Cifra
              etiqueta="Frente al punto de equilibrio"
              valor={`${realDia >= r.puntoEquilibrioLitros ? "+" : ""}${litros(realDia - r.puntoEquilibrioLitros)}`}
              alerta={realDia < r.puntoEquilibrioLitros}
            />
            <p className="text-sm text-tinta-suave sm:col-span-4">
              Promedio de {litrosPorDia.size} días con ordeño. Si la producción real se mantiene, el ingreso mensual por leche sería de{" "}
              <strong>{pesos(realDia * 30 * r.precio)}</strong> frente a {pesos(r.ingresosMes)} presupuestados.
            </p>
          </div>
        )}
      </Tarjeta>

      <Tarjeta>
        <TituloTarjeta>Producción - ingresos</TituloTarjeta>
        <TablaDinero
          columnas={["Lts día", "Vr día", "Lts mes", "Vr mes", "%"]}
          filas={r.ingresos.map((i) => [i.nombre, num(i.litrosDia), pesos(i.valorDia), num(i.litrosMes), pesos(i.valorMes), pct(r.ingresosMes ? i.valorMes / r.ingresosMes : 0)])}
          total={["Total ingresos producción", num(r.litrosDia), pesos(r.ingresosMes / 30), num(r.litrosDia * 30), pesos(r.ingresosMes), pct(1)]}
        />
      </Tarjeta>

      <div className="grid gap-5 lg:grid-cols-2">
        {r.categorias.map((c) => (
          <Tarjeta key={c.categoria} className="break-inside-avoid">
            <TituloTarjeta detalle={pct(c.pct)}>Costos {c.categoria.toLowerCase()}</TituloTarjeta>
            <TablaDinero
              columnas={["Vr día", "Vr mes", "%"]}
              filas={c.items.map((i) => [
                <span key="n">
                  {i.nombre}
                  {i.caja === false && <span className="ml-1 text-xs text-tinta-suave">(no sale de caja)</span>}
                </span>,
                pesos(i.dia),
                pesos(i.mes),
                pct(i.pct),
              ])}
              total={[`Total ${c.categoria.toLowerCase()}`, pesos(c.totalDia), pesos(c.totalMes), pct(c.pct)]}
            />
          </Tarjeta>
        ))}
      </div>

      <Tarjeta>
        <TituloTarjeta>Totales</TituloTarjeta>
        <TablaDinero
          columnas={["Vr día", "Vr mes", "%"]}
          filas={[
            ["Total ingresos", pesos(r.ingresosMes / 30), pesos(r.ingresosMes), pct(1)],
            ["Total costos - gastos", pesos(r.costosMes / 30), pesos(r.costosMes), pct(r.ingresosMes ? r.costosMes / r.ingresosMes : 0)],
            [
              <strong key="u">Total utilidad producción</strong>,
              <Signo key="ud" v={r.utilidadMes} texto={pesos(r.utilidadMes / 30)} />,
              <Signo key="um" v={r.utilidadMes} texto={pesos(r.utilidadMes)} />,
              pct(r.margen),
            ],
            [
              `Valorización terneras y novillas (${num(p.animales.novillas + p.animales.terneronas + p.animales.terneras)} animales)`,
              pesos(r.valorizacionMes / 30),
              pesos(r.valorizacionMes),
              pct(r.ingresosMes ? r.valorizacionMes / r.ingresosMes : 0),
            ],
          ]}
          total={["Utilidad con valorización de terneras y novillas", pesos(r.utilidadTotalMes / 30), pesos(r.utilidadTotalMes), pct(r.margenTotal)]}
        />
      </Tarjeta>

      <div className="grid gap-5 lg:grid-cols-3">
        <Tarjeta>
          <TituloTarjeta>Indicadores productivos y financieros</TituloTarjeta>
          <Filas
            filas={[
              ["Producción promedio por vaca/día", litros(r.promedioVaca)],
              ["Costo producción por litro", pesos(r.costoLitro)],
              ["Precio de venta litro", pesos(r.precio)],
            ]}
            total={["Utilidad litro de leche", pesos(r.utilidadLitro)]}
          />
        </Tarjeta>
        <Tarjeta>
          <TituloTarjeta>Punto de equilibrio en litros</TituloTarjeta>
          <Filas
            filas={[
              ["Punto de equilibrio litros leche día", litros(r.puntoEquilibrioLitros)],
              ["Producción actual litros leche día", litros(r.litrosDia)],
            ]}
            total={["Margen sobre el punto de equilibrio", <Signo key="me" v={r.margenEquilibrioLitros} texto={litros(r.margenEquilibrioLitros)} />]}
          />
        </Tarjeta>
        <Tarjeta>
          <TituloTarjeta>Utilidad con valorización</TituloTarjeta>
          <Filas
            filas={[
              ["Valorización mensual terneras", pesos(r.valorizacionMes)],
              ["Utilidad total incluyendo valorización", pesos(r.utilidadTotalMes)],
            ]}
            total={["Margen ajustado con la valorización", pct(r.margenTotal)]}
          />
        </Tarjeta>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Tarjeta>
          <TituloTarjeta>Conclusiones gerenciales</TituloTarjeta>
          <ul className="space-y-3 text-sm">
            <li className="flex justify-between gap-3 border-b border-tinta/10 pb-2">
              <span>
                <strong>{r.mayorCosto?.categoria ?? "—"}</strong> presenta el mayor costo
              </span>
              <strong>{pct(r.mayorCosto?.pct)}</strong>
            </li>
            <Conclusion
              titulo="Margen de la operación en producción"
              estado={r.estado}
              valor={r.margen}
              regla="Mayor o igual a 8% es rentable, mayor o igual a 3% ajustada, por debajo de 3% en riesgo."
            />
            <Conclusion
              titulo="Margen de la operación en producción + levante"
              estado={r.estadoTotal}
              valor={r.margenTotal}
              regla="Mayor a 8% es rentable, mayor a 5% ajustada, de 0 a 5% en riesgo."
            />
            <Conclusion
              titulo="Margen del flujo de caja"
              estado={r.caja.estado}
              valor={r.caja.margen}
              regla="Mayor o igual a 5% es rentable, mayor o igual a 2% ajustada, por debajo de 2% en riesgo."
            />
          </ul>
        </Tarjeta>
        <Tarjeta>
          <TituloTarjeta>Recomendaciones</TituloTarjeta>
          <ol className="list-decimal space-y-2 pl-5 text-sm">
            {recomendaciones(r, realDia).map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ol>
          <ul className="mt-4 grid gap-1 rounded-xl bg-crema p-3 text-xs text-tinta-suave sm:grid-cols-2">
            <li>Nota 1: no incluye depreciaciones.</li>
            <li>Nota 2: no incluye valorizaciones de activos.</li>
            <li>Nota 3: solo se valorizan terneras y novillas.</li>
            <li>Nota 4: las depreciaciones se miran aparte.</li>
          </ul>
        </Tarjeta>
      </div>

      <Tarjeta className="break-inside-avoid">
        <TituloTarjeta detalle={`Costos ${pct(r.ingresosMes ? r.costosMes / r.ingresosMes : 0)} · utilidad ${pct(r.margen)}`}>
          Costos y gastos frente al ingreso en %
        </TituloTarjeta>
        <GraficaCostosPct datos={r.categorias.map((c) => ({ categoria: c.categoria, pct: c.pct }))} />
      </Tarjeta>

      <Tarjeta className="break-inside-avoid">
        <TituloTarjeta detalle={<Etiqueta tono={TONO_ESTADO[r.caja.estado]}>{r.caja.estado}</Etiqueta>}>Flujo de caja para el mes</TituloTarjeta>
        <div className="grid gap-5 lg:grid-cols-[1fr_1.4fr]">
          <div className="space-y-4">
            <Filas
              filas={[
                ["Precio venta litro de leche", pesos(r.precio)],
                ["Producción día (venta)", litros(p.litros_dia.venta)],
                ["Producción mes", litros(p.litros_dia.venta * 30)],
                ["Vacas en producción", num(p.animales.vacas_produccion)],
                ["Ingresos en dinero", pesos(r.caja.ingresos)],
                ["Pagos en dinero", pesos(r.caja.pagos)],
                ["Saldo caja final", <Signo key="s" v={r.caja.saldo} texto={pesos(r.caja.saldo)} />],
              ]}
              total={["Margen", pct(r.caja.margen)]}
            />
            <GraficaFlujoCaja ingresos={r.caja.ingresos} pagos={r.caja.pagos} saldo={r.caja.saldo} />
            {r.caja.saldo < 0 && (
              <p className="rounded-xl bg-[#fbe9e5] p-3 text-sm font-bold text-alerta">
                Tu flujo de caja da negativo: mira qué costos o gastos debes disminuir.
              </p>
            )}
          </div>
          <div>
            <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-tinta-suave">Pagos por categoría</h3>
            <GraficaPagos datos={r.caja.pagosPorCategoria} />
            <TablaDinero
              columnas={["Vr día", "Vr mes", "%"]}
              filas={r.caja.pagosPorCategoria.map((c) => [c.categoria, pesos(c.mes / 30), pesos(c.mes), pct(r.caja.ingresos ? c.mes / r.caja.ingresos : 0)])}
              total={["Total movimientos pagados", pesos(r.caja.pagos / 30), pesos(r.caja.pagos), pct(r.caja.ingresos ? r.caja.pagos / r.caja.ingresos : 0)]}
            />
          </div>
        </div>
      </Tarjeta>
    </div>
  );
}

function recomendaciones(r: Informe, realDia: number | null) {
  const lista: string[] = [];
  const mayor = r.mayorCosto?.categoria.toLowerCase() ?? "";
  const top3 = [...r.categorias].sort((a, b) => b.totalMes - a.totalMes).slice(0, 3).map((c) => c.categoria.toLowerCase());

  if (mayor.includes("concentrado")) {
    lista.push("Tratar de optimizar costos de alimentación.", "La alimentación trabajarla con pastos abundantes.");
  } else if (mayor.includes("fertiliz")) {
    lista.push("Revisar el plan de fertilización: aplicar según análisis de suelo y rotación de potreros.");
  } else if (mayor.includes("nómina")) {
    lista.push("Revisar la carga laboral y la productividad por trabajador.");
  } else if (mayor) {
    lista.push(`Revisar a fondo los costos de ${mayor}, que son el mayor rubro.`);
  }
  if (top3.some((c) => c.includes("concentrado")) && top3.some((c) => c.includes("fertiliz"))) {
    lista.push("Fertilizar mejor y disminuir concentrado.");
  }
  if (r.margen < 0.08) lista.push("Mejorar la productividad de cada vaca.");
  if (r.estado !== "RENTABLE") lista.push("Mantener control estricto de los gastos operativos.");
  if (r.litrosDia && r.margenEquilibrioLitros / r.litrosDia < 0.05) {
    lista.push(`La producción está a solo ${num(r.margenEquilibrioLitros)} L/día del punto de equilibrio: cualquier baja genera pérdida.`);
  }
  if (realDia != null && realDia < r.litrosDia) {
    lista.push(`La producción registrada (${num(realDia)} L/día) está por debajo de la presupuestada: actualizar parámetros o revisar el hato.`);
  }
  if (r.caja.saldo < 0) lista.push("El flujo de caja da negativo: priorizar pagos y disminuir costos o gastos.");
  if (lista.length === 0) lista.push("Mantener la operación actual y seguir registrando los datos diarios.");
  return lista;
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="flex justify-between gap-2 border-b border-tinta/10 py-1">
      <dt className="text-tinta-suave">{etiqueta}</dt>
      <dd className="font-bold">{valor}</dd>
    </div>
  );
}

function Bloque({ titulo, clase, children }: { titulo: string; clase: string; children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-2xl border-2 border-bosque/80 bg-white">
      <h3 className={clsx("px-3 py-2 text-center text-sm font-extrabold uppercase", clase)}>{titulo}</h3>
      {children}
    </section>
  );
}

function Filas({ filas, total }: { filas: [React.ReactNode, React.ReactNode][]; total?: [React.ReactNode, React.ReactNode] }) {
  return (
    <table className="w-full text-sm">
      <tbody>
        {filas.map(([e, v], i) => (
          <tr key={i} className="border-b border-tinta/10">
            <td className="px-3 py-1.5 text-tinta-suave">{e}</td>
            <td className="px-3 py-1.5 text-right font-bold tabular-nums">{v}</td>
          </tr>
        ))}
      </tbody>
      {total && (
        <tfoot>
          <tr className="bg-lima-suave font-bold text-bosque">
            <td className="px-3 py-2">{total[0]}</td>
            <td className="px-3 py-2 text-right tabular-nums">{total[1]}</td>
          </tr>
        </tfoot>
      )}
    </table>
  );
}

function TablaDinero({ columnas, filas, total }: { columnas: string[]; filas: React.ReactNode[][]; total: React.ReactNode[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[480px] text-sm">
        <thead>
          <tr className="border-b-2 border-bosque text-xs uppercase text-tinta-suave">
            <th className="py-2 pr-2 text-left">Concepto</th>
            {columnas.map((c) => (
              <th key={c} className="px-2 py-2 text-right">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((f, i) => (
            <tr key={i} className="border-b border-tinta/10">
              {f.map((c, j) => (
                <td key={j} className={clsx("py-1.5", j === 0 ? "pr-2" : "px-2 text-right tabular-nums")}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-lima-suave font-bold uppercase text-bosque">
            {total.map((c, j) => (
              <td key={j} className={clsx("py-2", j === 0 ? "px-2 text-xs" : "px-2 text-right tabular-nums")}>
                {c}
              </td>
            ))}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function Signo({ v, texto }: { v: number; texto: string }) {
  return <span className={clsx(v < 0 && "text-alerta")}>{texto}</span>;
}

function Cifra({ etiqueta, valor, alerta = false }: { etiqueta: string; valor: string; alerta?: boolean }) {
  return (
    <div className={clsx("rounded-2xl border p-4", alerta ? "border-alerta/25 bg-[#fbe9e5]" : "border-[#cadba8] bg-lima-suave")}>
      <span className={clsx("font-display block text-2xl font-bold", alerta ? "text-alerta" : "text-bosque")}>{valor}</span>
      <span className="text-sm text-tinta-suave">{etiqueta}</span>
    </div>
  );
}

function Semaforo({ titulo, estado, valor }: { titulo: string; estado: Estado; valor: number }) {
  const color = { RENTABLE: "bg-pasto", AJUSTADA: "bg-dorado", "EN RIESGO": "bg-alerta" }[estado];
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-tinta/10 bg-leche p-3">
      <span className="flex items-center gap-2">
        <span className={clsx("h-4 w-4 rounded-full ring-2 ring-white", color)} aria-hidden />
        <span className="text-sm font-bold">{titulo}</span>
      </span>
      <span className="flex items-center gap-2">
        <Etiqueta tono={TONO_ESTADO[estado]}>{estado}</Etiqueta>
        <strong className="tabular-nums">{pct(valor)}</strong>
      </span>
    </div>
  );
}

function Conclusion({ titulo, estado, valor, regla }: { titulo: string; estado: Estado; valor: number; regla: string }) {
  return (
    <li className="border-b border-tinta/10 pb-2 last:border-0">
      <div className="flex items-center justify-between gap-3">
        <span>{titulo}</span>
        <span className="flex items-center gap-2">
          <strong className="tabular-nums">{pct(valor)}</strong>
          <Etiqueta tono={TONO_ESTADO[estado]}>{estado}</Etiqueta>
        </span>
      </div>
      <p className="mt-1 text-xs text-tinta-suave">{regla}</p>
    </li>
  );
}
