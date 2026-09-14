import clsx from "clsx";
import { obtenerSesion, ROLES_GESTORES, type Sesion } from "@/lib/sesion";
import { MENSAJE_SOLO_LECTURA, soloLectura } from "@/lib/permisos";
import { corteDeFinca } from "@/lib/datos";
import { fecha, hoyISO, num, pesos } from "@/lib/formato";
import { consultarPagina, leerPagina } from "@/lib/paginacion";
import { atajosDias, completarRango, leerRangoPedido, textoRango } from "@/lib/rango";
import { Encabezado, Etiqueta, Metrica, Tarjeta, TituloTarjeta, Vacio } from "@/components/ui";
import { Paginacion } from "@/components/paginacion";
import { RangoFechas } from "@/components/rango-fechas";
import { fincaElegida, uno } from "@/components/inventario/comun";
import { TablaSaldos, type Saldo } from "@/components/inventario/tabla-saldos";
import { FormularioMovimiento } from "@/components/inventario/formulario-movimiento";
import { CatalogoInsumos } from "@/components/inventario/catalogo-insumos";
import { ConsumoAutomatico } from "@/components/inventario/consumo-automatico";
import type { ReglaConsumo } from "@/components/inventario/consumo";
import type { Insumo } from "@/components/inventario/opciones";

export const metadata = { title: "Inventario" };

const POR_PAGINA = 30;

/** Corte por defecto: el de la finca, pero sin dejar por fuera movimientos o consumos registrados después. */
async function corteInventario(supabase: Sesion["supabase"], fincaId: string, hoy: string) {
  const [corte, { data: mov }, { data: cons }] = await Promise.all([
    corteDeFinca(supabase, fincaId),
    supabase.from("movimientos_insumos").select("fecha").eq("finca_id", fincaId).lte("fecha", hoy).order("fecha", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("consumos_diarios").select("fecha").eq("finca_id", fincaId).lte("fecha", hoy).order("fecha", { ascending: false }).limit(1).maybeSingle(),
  ]);
  return [corte, mov?.fecha, cons?.fecha].filter((f): f is string => !!f).sort().at(-1)!;
}

export default async function InventarioPage(props: PageProps<"/inventario">) {
  const sp = await props.searchParams;
  const sesion = await obtenerSesion();
  const { supabase, fincas, organizacionId, rol } = sesion;

  if (fincas.length === 0) {
    return (
      <div className="space-y-6">
        <Encabezado eyebrow="Inventario" titulo="Inventario con saldo" />
        <Tarjeta>
          <Vacio>Tu organización todavía no tiene fincas registradas.</Vacio>
        </Tarjeta>
      </div>
    );
  }

  const finca = await fincaElegida(sesion, uno(sp.finca));
  const hoy = hoyISO();
  // hasta (antes «Saldo al», ?corte= heredado) = fecha del saldo; desde–hasta filtra movimientos y consumos diarios.
  const pedido = leerRangoPedido(sp);
  const referencia = await corteInventario(supabase, finca.id, hoy);
  const rango = completarRango(pedido, referencia);
  const corte = rango.hasta;
  const gestor = ROLES_GESTORES.includes(rol);
  const lectura = soloLectura(rol);

  const [{ data: saldosData, error: errorSaldos }, { data: insumosData }, movimientos, consumos, { data: reglasData }, { data: animalesDia }] =
    await Promise.all([
      supabase.rpc("saldo_insumos", { p_finca: finca.id, p_corte: corte }),
      supabase
        .from("insumos")
        .select("id, nombre, categoria, unidad, contenido, precio, stock_minimo, consumo_diario_fuente")
        .eq("organizacion_id", organizacionId)
        .order("nombre"),
      consultarPagina(
        (desde, hasta) =>
          supabase
            .from("movimientos_insumos")
            .select("id, insumo_id, producto, fecha, hora, tipo, cantidad, entrega, recibe", { count: "exact" })
            .eq("finca_id", finca.id)
            .gte("fecha", rango.desde)
            .lte("fecha", corte)
            .order("fecha", { ascending: false })
            .order("registrado_en", { ascending: false })
            .order("id")
            .range(desde, hasta),
        leerPagina(sp, { param: "pmov", tamano: POR_PAGINA }),
      ),
      consultarPagina(
        (desde, hasta) =>
          supabase
            .from("consumos_diarios")
            .select("id, fecha, kg_concentrado_vacas, kg_sal_vacas, kg_concentrado_terneras, kg_sal_terneras", { count: "exact" })
            .eq("finca_id", finca.id)
            .gte("fecha", rango.desde)
            .lte("fecha", corte)
            .order("fecha", { ascending: false })
            .order("id")
            .range(desde, hasta),
        leerPagina(sp, { param: "pcons", tamano: POR_PAGINA }),
      ),
      supabase
        .from("consumos_programados")
        .select("id, insumo_id, modo, cantidad, en_kg, periodo, grupo, desde, hasta, activo, notas")
        .eq("finca_id", finca.id)
        .order("activo", { ascending: false })
        .order("desde", { ascending: false }),
      supabase.rpc("animales_por_dia", { p_finca: finca.id, p_desde: corte, p_hasta: corte }),
    ]);

  const saldos = (saldosData ?? []) as Saldo[];
  const insumos = (insumosData ?? []) as Insumo[];
  const reglas = (reglasData ?? []) as ReglaConsumo[];
  const porId = new Map(insumos.map((i) => [i.id, i]));
  const dia = animalesDia?.[0];
  const conteos = dia ? { vacas_ordeno: dia.vacas_ordeno, vacas_horras: dia.vacas_horras, levante: dia.levante, todos: dia.todos } : null;

  const alertas = saldos.filter((s) => s.estado !== "ok");
  const valor = saldos.reduce((t, s) => t + Math.max(Number(s.saldo), 0) * Number((s.insumo_id && porId.get(s.insumo_id)?.precio) ?? 0), 0);
  const sinPrecio = saldos.filter((s) => s.saldo > 0 && !(s.insumo_id && porId.get(s.insumo_id)?.precio)).length;
  const proximo = [...saldos]
    .filter((s) => s.estado === "agotado" || s.dias_alcanza != null)
    .sort((a, b) => (a.estado === "agotado" ? -1 : Number(a.dias_alcanza)) - (b.estado === "agotado" ? -1 : Number(b.dias_alcanza)))[0];

  return (
    <div className="space-y-6">
      <Encabezado
        eyebrow={`Inventario · ${finca.nombre}`}
        titulo="Inventario con saldo"
        descripcion={`Saldo al ${fecha(corte, true)}: lo que ha entrado, menos las salidas, menos el consumo diario registrado en VacDaTa y el consumo automático programado.`}
      />

      <div className="papel space-y-4 rounded-2xl p-4">
        <form action="/inventario" className="flex flex-wrap items-end gap-3">
          {pedido.todo ? <input type="hidden" name="desde" value="todo" /> : pedido.desde && <input type="hidden" name="desde" value={pedido.desde} />}
          {pedido.hasta && <input type="hidden" name="hasta" value={pedido.hasta} />}
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
          ruta="/inventario"
          searchParams={sp}
          desde={rango.todo ? "" : rango.desde}
          hasta={corte}
          texto={textoRango(rango)}
          atajos={atajosDias(referencia, rango)}
          referencia={referencia}
          nota="El saldo se calcula a la fecha «hasta»; los movimientos y consumos diarios se filtran por el rango."
          className="border-t border-black/10 pt-4"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Metrica
          tono={alertas.length ? "alerta" : "lima"}
          valor={alertas.length}
          etiqueta={
            alertas.length
              ? `Productos bajos o agotados: ${alertas.map((a) => a.producto).join(", ")}`
              : "Productos bajos o agotados"
          }
        />
        <Metrica
          tono="crema"
          valor={pesos(valor)}
          etiqueta={`Valor estimado del inventario (saldo × precio)${sinPrecio ? ` · ${sinPrecio} sin precio` : ""}`}
        />
        <Metrica
          tono={proximo && (proximo.estado === "agotado" || Number(proximo.dias_alcanza) < 3) ? "alerta" : "lima"}
          valor={proximo ? proximo.producto : "—"}
          etiqueta={
            !proximo
              ? "Próximo a agotarse: no hay consumo reciente"
              : proximo.estado === "agotado"
                ? "Próximo a agotarse: ya está agotado"
                : `Próximo a agotarse: alcanza para ${num(proximo.dias_alcanza)} días`
          }
        />
      </div>

      <Tarjeta>
        <TituloTarjeta detalle={`${saldos.length} productos con movimientos`}>Saldo por insumo</TituloTarjeta>
        {errorSaldos ? (
          <Vacio>No se pudo calcular el saldo: {errorSaldos.message}</Vacio>
        ) : saldos.length === 0 ? (
          <Vacio>Todavía no hay ingresos ni salidas de insumos registrados en {finca.nombre}.</Vacio>
        ) : (
          <>
            <TablaSaldos saldos={saldos} />
            <p className="mt-3 text-xs text-tinta-suave">
              El consumo diario es el promedio de salidas y consumos de los últimos 30 días, más el consumo automático. Queda <strong>bajo</strong> si
              alcanza para menos de 7 días o está por debajo del mínimo.
            </p>
          </>
        )}
      </Tarjeta>

      <Tarjeta>
        <TituloTarjeta detalle={`${reglas.filter((r) => r.activo).length} activas`}>Consumo automático</TituloTarjeta>
        <p className="mb-4 text-sm text-tinta-suave">
          Para no registrar cada salida: asigna un gasto fijo por día, mes o año, o uno que aumenta con la cantidad de animales. Se descuenta
          del saldo día por día desde la fecha de inicio; en las reglas por animal se usa el número de animales del grupo en cada día.
          {lectura && ` ${MENSAJE_SOLO_LECTURA}`}
        </p>
        <ConsumoAutomatico
          key={finca.id}
          fincaId={finca.id}
          hoy={hoy}
          corte={corte}
          reglas={reglas}
          insumos={insumos.map(({ id, nombre, unidad, contenido }) => ({ id, nombre, unidad, contenido }))}
          conteos={conteos}
          puedeEditar={!lectura}
          puedeBorrar={gestor}
        />
      </Tarjeta>

      <div className={clsx("grid gap-6", !lectura && "lg:grid-cols-[1fr_1.3fr]")}>
        {!lectura && (
          <Tarjeta>
            <TituloTarjeta>Registrar movimiento</TituloTarjeta>
            <FormularioMovimiento fincaId={finca.id} hoy={hoy} catalogo={insumos.map(({ nombre, unidad, contenido }) => ({ nombre, unidad, contenido }))} />
          </Tarjeta>
        )}

        <Tarjeta id="movimientos" className="scroll-mt-6">
          <TituloTarjeta detalle={`${num(movimientos.total)} · ${textoRango(rango).toLowerCase()}`}>Movimientos</TituloTarjeta>
          {!movimientos.filas.length ? (
            <Vacio>No hay movimientos en este rango ({textoRango(rango).toLowerCase()}).</Vacio>
          ) : (
            <div className="max-h-[28rem] overflow-auto">
              <table className="w-full min-w-[520px] text-sm">
                <thead className="sticky top-0 bg-leche">
                  <tr className="border-b-2 border-bosque text-left text-xs uppercase text-tinta-suave">
                    <th className="py-2 pr-2">Fecha</th>
                    <th className="px-2 py-2">Tipo</th>
                    <th className="px-2 py-2">Producto</th>
                    <th className="px-2 py-2 text-right">Cantidad</th>
                    <th className="py-2 pl-2">Entrega → recibe</th>
                  </tr>
                </thead>
                <tbody>
                  {movimientos.filas.map((m) => (
                    <tr key={m.id} className="border-b border-tinta/10">
                      <td className="py-2 pr-2 tabular-nums">
                        {fecha(m.fecha)}
                        {m.hora && <span className="block text-xs text-tinta-suave">{m.hora.slice(0, 5)}</span>}
                      </td>
                      <td className="px-2 py-2">
                        <Etiqueta tono={m.tipo === "ingreso" ? "verde" : "amarillo"}>{m.tipo === "ingreso" ? "Ingreso" : "Salida"}</Etiqueta>
                      </td>
                      <td className="px-2 py-2 font-bold text-bosque">{m.producto}</td>
                      <td className={clsx("px-2 py-2 text-right tabular-nums", m.tipo === "salida" && "text-cafe")}>
                        {m.tipo === "ingreso" ? "+" : "−"}
                        {num(m.cantidad)} {(m.insumo_id && porId.get(m.insumo_id)?.unidad) ?? ""}
                      </td>
                      <td className="py-2 pl-2 text-tinta-suave">{[m.entrega, m.recibe].filter(Boolean).join(" → ") || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Paginacion
            ruta="/inventario"
            searchParams={sp}
            param="pmov"
            pagina={movimientos.pagina.pagina}
            tamano={movimientos.pagina.tamano}
            total={movimientos.total}
            unidad="movimientos"
            etiqueta="Páginas de movimientos"
            ancla="movimientos"
          />
        </Tarjeta>
      </div>

      <Tarjeta id="consumos" className="scroll-mt-6">
        <TituloTarjeta detalle={`Kilos registrados en VacDaTa · ${num(consumos.total)} días con registro en el rango`}>Consumos diarios</TituloTarjeta>
        {!consumos.filas.length ? (
          <Vacio>No hay consumos diarios registrados en este rango ({textoRango(rango).toLowerCase()}).</Vacio>
        ) : (
          <div className="max-h-80 overflow-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="sticky top-0 bg-leche">
                <tr className="border-b-2 border-bosque text-xs uppercase text-tinta-suave">
                  <th className="py-2 pr-2 text-left">Fecha</th>
                  <th className="px-2 py-2 text-right">Concentrado vacas</th>
                  <th className="px-2 py-2 text-right">Sal vacas</th>
                  <th className="px-2 py-2 text-right">Concentrado terneras</th>
                  <th className="py-2 pl-2 text-right">Sal terneras</th>
                </tr>
              </thead>
              <tbody>
                {consumos.filas.map((c) => (
                  <tr key={c.id} className="border-b border-tinta/10 tabular-nums">
                    <td className="py-1.5 pr-2">{fecha(c.fecha)}</td>
                    <td className="px-2 py-1.5 text-right">{kg(c.kg_concentrado_vacas)}</td>
                    <td className="px-2 py-1.5 text-right">{kg(c.kg_sal_vacas)}</td>
                    <td className="px-2 py-1.5 text-right">{kg(c.kg_concentrado_terneras)}</td>
                    <td className="py-1.5 pl-2 text-right">{kg(c.kg_sal_terneras)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Paginacion
          ruta="/inventario"
          searchParams={sp}
          param="pcons"
          pagina={consumos.pagina.pagina}
          tamano={consumos.pagina.tamano}
          total={consumos.total}
          unidad="días"
          etiqueta="Páginas de consumos diarios"
          ancla="consumos"
        />
      </Tarjeta>

      {gestor && (
        <Tarjeta>
          <TituloTarjeta detalle="Compartido por todas las fincas de la organización">Catálogo de insumos</TituloTarjeta>
          <CatalogoInsumos insumos={insumos} />
        </Tarjeta>
      )}
    </div>
  );
}

const kg = (v: number | null) => (v == null ? "—" : `${num(v)} kg`);
